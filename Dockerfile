FROM python:3.12-slim
WORKDIR /app
COPY mcp_hub.py .
COPY src/supabase_server.py ./src/
EXPOSE 8000
CMD ["python", "mcp_hub.py"]
