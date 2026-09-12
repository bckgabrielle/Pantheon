from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Held server-side only. The browser extension calls THIS service;
    # it never sees this key.
    groq_api_key: str

    # Model used for the agent loop. Override via env if needed.
    agent_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Component #2's backend base URL + the token this service authenticates
    # to it with.
    backend_base_url: str = "http://localhost:8001"
    backend_api_key: str = ""
    backend_user_id: str = "default"
    cors_origins: str = "http://localhost:5173"

    # Guardrails
    max_close_actions_per_plan: int = 10
    max_tool_loop_iterations: int = 8
    rate_limit_requests: int = 20
    rate_limit_window_seconds: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
