from abc import ABC, abstractmethod
from app.models import LoginRequest, User
from app.database import get_database
from app.auth import verify_password

class LoginStrategy(ABC):
    @abstractmethod
    async def authenticate(self, login_data: LoginRequest) -> User:
        pass

class EmailPasswordLoginStrategy(LoginStrategy):
    async def authenticate(self, login_data: LoginRequest) -> User:
        db = get_database()
        user = await db.users.find_one({"email": login_data.email})
        
        if not user:
            raise ValueError("Invalid email or password")
        
        if not verify_password(login_data.password, user["password"]):
            raise ValueError("Invalid email or password")
        
        return User(**user)

class LoginFactory:
    def __init__(self):
        self.strategies = {
            "email_password": EmailPasswordLoginStrategy()
        }
    
    def get_strategy(self, strategy_type: str = "email_password") -> LoginStrategy:
        strategy = self.strategies.get(strategy_type)
        if not strategy:
            raise ValueError(f"Login strategy {strategy_type} not found")
        return strategy
    
    def register_strategy(self, name: str, strategy: LoginStrategy):
        self.strategies[name] = strategy

login_factory = LoginFactory()

