from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from rag import CSVChatbot
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chatbot = CSVChatbot()


@app.get("/")
def home():
    return {"message": "Chat with CSV API running 🚀"}



@app.post("/upload/")
async def upload_csv(file: UploadFile = File(..., media_type="multipart/form-data")):
    os.makedirs("temp", exist_ok=True)

    file_path = f"temp/{file.filename}"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    chatbot.load_csv(file_path)

    return {"message": "Uploaded successfully"}


@app.get("/ask/")
def ask(q: str):
    return {"answer": chatbot.query(q)}