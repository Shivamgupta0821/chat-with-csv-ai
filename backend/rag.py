import re
import requests
import numpy as np
import pandas as pd
import faiss
from sentence_transformers import SentenceTransformer


EMBED_MODEL   = "all-MiniLM-L6-v2"
OLLAMA_URL    = "http://localhost:11434/api/generate"
OLLAMA_MODEL  = "tinyllama"
TOP_K         = 3
BATCH_SIZE    = 256
MAX_CTX_CHARS = 1500


class CSVChatbot:

    def __init__(self):
        print("Loading embedding model...")
        self.model     = SentenceTransformer(EMBED_MODEL)
        self.index     = None
        self.documents = []   # "col: val | col: val" strings, one per row
        self.df        = None
        self.col_names = []   # original column names (lowercased)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. LOAD CSV
    # ──────────────────────────────────────────────────────────────────────────

    def load_csv(self, file_path: str):
        print(f"Loading CSV: {file_path}")

        # Encoding fallback
        try:
            df = pd.read_csv(file_path)
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="latin-1", on_bad_lines="skip")

        df.dropna(how="all", inplace=True)
        df.fillna("", inplace=True)
        df.reset_index(drop=True, inplace=True)

        if df.empty:
            raise ValueError("CSV is empty after cleaning.")

        # Normalize column names: lowercase + strip whitespace
        df.columns = df.columns.str.lower().str.strip()
        self.df        = df
        self.col_names = df.columns.tolist()

        print(f"Rows: {len(df)}  |  Columns: {self.col_names}")

        # ── Serialize rows WITH column names ──────────────────────────────────
        def row_to_text(row):
            parts = [f"{col}: {str(val).strip()}" for col, val in row.items() if str(val).strip()]
            return " | ".join(parts)

        self.documents = df.apply(row_to_text, axis=1).tolist()
        self.documents = [d for d in self.documents if d.strip()]

        # ── Embed in batches (no row limit) ───────────────────────────────────
        print(f"Embedding {len(self.documents)} rows...")
        all_embeddings = []
        for start in range(0, len(self.documents), BATCH_SIZE):
            batch = self.documents[start: start + BATCH_SIZE]
            emb   = self.model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
            all_embeddings.append(emb)

        embeddings = np.vstack(all_embeddings).astype("float32")

        # ── Normalize → cosine similarity via IndexFlatIP ─────────────────────       
        faiss.normalize_L2(embeddings)
        self.index = faiss.IndexFlatIP(embeddings.shape[1])
        self.index.add(embeddings)

        print(f"Ready! {self.index.ntotal} vectors indexed.")

    # ──────────────────────────────────────────────────────────────────────────
    # 2. COLUMN MATCHING  (robust — handles underscores, spaces, case)
    # ──────────────────────────────────────────────────────────────────────────

    def _normalize(self, text: str) -> str:
        """Lowercase, replace underscores/hyphens with space, strip extras."""
        return re.sub(r"[\s_\-]+", " ", text.lower()).strip()

    def find_column(self, question: str):
        """
        Return the best-matching column name for a question, or None.
        Strategy: try longest match first so "petal length" beats "length".
        """
        q_norm = self._normalize(question)

        # Sort columns longest-first so multi-word columns win over short ones
        sorted_cols = sorted(self.col_names, key=lambda c: len(c), reverse=True)

        for col in sorted_cols:
            col_norm = self._normalize(col)
            if col_norm in q_norm:
                return col

        return None

    def find_two_columns(self, question: str):
        """
        STRICT: requires one numeric value_col AND one categorical label_col.
        Prevents "highest sepal width" matching two numeric cols.
        """
        q_norm = self._normalize(question)

        numeric_cols     = []
        categorical_cols = []
        for col in self.col_names:
            converted = pd.to_numeric(self.df[col], errors="coerce")
            if converted.notna().sum() > len(self.df) * 0.5:
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)

        value_col = None
        for col in sorted(numeric_cols, key=len, reverse=True):
            if self._normalize(col) in q_norm:
                value_col = col
                break

        label_col = None
        for col in sorted(categorical_cols, key=len, reverse=True):
            if self._normalize(col) in q_norm:
                label_col = col
                break

        if value_col and label_col:
            return label_col, value_col
        return None, None

    # ──────────────────────────────────────────────────────────────────────────
    # 3. LLM CALL
    # ──────────────────────────────────────────────────────────────────────────

    def _call_llm(self, question: str, context_rows: list) -> str:
        context = "\n".join(context_rows)
        if len(context) > MAX_CTX_CHARS:
            context = context[:MAX_CTX_CHARS] + "\n...[truncated]"

        col_info = ", ".join(self.col_names)

        prompt = f"""Columns: {col_info}

Data:
{context}

Q: {question}
A (one concise line, use only the data above):"""

        try:
            # stream=True — read tokens as they arrive instead of waiting for
            # the full response. Prevents timeout on slow CPUs with mistral.
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model"  : OLLAMA_MODEL,
                    "prompt" : prompt,
                    "stream" : True,
                    "options": {"temperature": 0, "num_predict": 150},
                },
                stream=True,
                timeout=30,   # 30s just to establish connection
            )
            response.raise_for_status()

            # Reassemble streamed JSON chunks into full answer text
            import json
            answer = ""
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode("utf-8"))
                        answer += chunk.get("response", "")
                        if chunk.get("done", False):
                            break
                    except Exception:
                        continue
            return answer.strip()

        except requests.exceptions.ConnectionError:
            return "Cannot connect to Ollama. Run `ollama serve` in a terminal."
        except requests.exceptions.Timeout:
            return "Ollama connection timed out. Make sure `ollama serve` is running."
        except Exception as e:
            return f"LLM error: {str(e)}"

    # ──────────────────────────────────────────────────────────────────────────
    # 4. QUERY — HYBRID (direct pandas + RAG + LLM fallback)
    # ──────────────────────────────────────────────────────────────────────────

    def query(self, question: str, k: int = TOP_K) -> str:
        if self.index is None:
            return "Please upload a CSV first."

        q = question.lower().strip()

        # Intent flags — computed once, reused throughout
        is_max   = any(x in q for x in ["highest", "largest", "maximum", "max", "most"])
        is_min   = any(x in q for x in ["lowest", "smallest", "minimum", "min", "least"])
        is_which = any(x in q for x in ["which", "who", "what"])

        # ── Basic metadata ────────────────────────────────────────────────────
        # Check these BEFORE column matching so "how many rows" never
        # accidentally falls into the numeric branch.
        if "how many rows" in q:
            return f"{len(self.df)} rows"

        if "how many columns" in q:
            return f"{len(self.df.columns)} columns"

        if any(x in q for x in ["column names", "what columns", "list columns", "columns are"]):
            return "Columns: " + ", ".join(self.col_names)

        if any(x in q for x in ["describe", "summary", "statistics"]):
            return self.df.describe().round(4).to_string()

        # ── "Which X has the highest/lowest Y" ────────────────────────────────
        if is_max or is_min:
            label_col, value_col = self.find_two_columns(q)
            if label_col and value_col:
                series    = pd.to_numeric(self.df[value_col], errors="coerce")
                idx       = series.idxmax() if is_max else series.idxmin()
                row       = self.df.iloc[idx]
                val       = round(series[idx], 4)
                label_val = row[label_col]
                return f"{label_col}: {label_val}  |  {value_col}: {val}"

        # ── Single-column numeric operations ──────────────────────────────────
        col = self.find_column(q)
        if col:
            series   = pd.to_numeric(self.df[col], errors="coerce")
            has_nums = series.notna().sum() > 0

            if has_nums:
                # ▶ max/min — highest priority
                if is_max:
                    idx = series.idxmax()
                    return f"{round(series[idx], 4)}  (row {idx})"

                if is_min:
                    idx = series.idxmin()
                    return f"{round(series[idx], 4)}  (row {idx})"

                if any(x in q for x in ["average", "mean"]):
                    return str(round(series.mean(), 4))

                if "median" in q:
                    return str(round(series.median(), 4))

                if "sum" in q:
                    return str(round(series.sum(), 4))

                if "std" in q or "standard deviation" in q:
                    return str(round(series.std(), 4))

                #  count — lowest priority (only if none of the above matched)
                if any(x in q for x in ["count", "how many"]):
                    return str(int(series.notna().sum()))

            # Non-numeric column — show value counts
            if any(x in q for x in ["unique", "distinct", "different", "count"]):
                counts = self.df[col].value_counts()
                return counts.to_string()

        # ── RAG + LLM fallback ────────────────────────────────────────────────
        q_vec = self.model.encode([question], convert_to_numpy=True).astype("float32")
        faiss.normalize_L2(q_vec)

        actual_k        = min(k, len(self.documents))
        scores, indices = self.index.search(q_vec, actual_k)

        retrieved = []
        for idx, score in zip(indices[0], scores[0]):
            if idx != -1:
                retrieved.append(self.documents[idx])

        if not retrieved:
            return "No relevant rows found in the CSV for your question."

        return self._call_llm(question, retrieved)