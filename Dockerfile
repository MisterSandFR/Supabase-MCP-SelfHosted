FROM python:3.12-slim
WORKDIR /app
COPY main.py .
COPY src/supabase_server.py ./src/
EXPOSE 8000
CMD ["python", "main.py"]
