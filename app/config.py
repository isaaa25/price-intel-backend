from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # database
    database_url:str 

    # jwt / auth tokesn
    secret_key:str 
    algorithm:str = "HS256"
    access_token_expire_minutes : int = 30 

    # App environment 

    env : str = "development"
    debug : bool = True

    # pydantic specific configurations 

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra='ignore' # This ignores extra variables in .env that aren't defined here
    )
"""@lru_cache() is the important part. Every time something in your app
calls get_settings(),without this decorator Python would re-read and re-parse the .env file from disk. 
With lru_cache, it reads once, caches the result,and every subsequent call gets the same object from memory. 
This matters in a web app where hundreds of requests per second might each trigger this call."""
@lru_cache
def get_settings() -> Settings:
    return Settings() 