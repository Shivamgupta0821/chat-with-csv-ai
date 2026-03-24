💬 Chat with CSV using AI

Turn any CSV file into a chat-based AI experience.
Upload your dataset and ask questions in natural language — get instant, intelligent answers.

🚀 Demo Idea
Upload a CSV (e.g., Iris dataset 📊)
Ask:
“How many rows are there?”
“What is the highest sepal length?”
“Which species has the largest petal length?”
🧠 How It Works

This project uses a Hybrid AI System:

1️⃣ Pandas (Exact Answers)
Handles:
count, max, min, mean, sum
Ensures 100% accurate numeric results
2️⃣ FAISS (Vector Search)
Converts rows into embeddings
Retrieves relevant data using similarity search
3️⃣ LLM via Ollama (Reasoning)
Uses local models like phi / mistral
Generates human-like answers from retrieved data
🏗️ Tech Stack
🔹 Backend
FastAPI
Pandas
FAISS
Sentence Transformers
Ollama (Local LLM)
🔹 Frontend
React (Vite)
Axios
⚙️ Installation & Setup
🔹 1. Clone the Repository
git clone https://github.com/Shivamgupta0821/chat-with-csv-ai.git
cd chat-with-csv-ai
🔹 2. Backend Setup
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

Start backend:

uvicorn app:app --port 5050
🔹 3. Install Ollama (for LLM)

Download: https://ollama.com

Run model:

ollama run mistral

(or use phi for lower memory systems)

🔹 4. Frontend Setup
cd frontend
npm install
npm run dev
🌐 API Endpoints
Upload CSV
POST /upload/
Ask Question
GET /ask/?q=your_question
🚧 Challenges Faced
❌ Handling large CSVs → solved with row limiting
❌ Incorrect LLM answers → fixed using Pandas routing
❌ Column mismatch issues → built smart column matching
❌ Git large file errors → resolved by cleaning repo & proper .gitignore
❌ Local memory constraints → used lightweight Ollama models
💡 Key Learnings

AI is not just about models —
it’s about combining data + logic + retrieval + reasoning

🔮 Future Improvements
📊 Data visualization (charts)
🧠 Chat memory
🌐 Deployment (public link)
📁 Support for Excel / JSON

🙌 Author
Shivam Gupta
Computer Science Engineering Student
