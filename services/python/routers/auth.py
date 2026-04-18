from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from models.schemas import UserProfile
from services.storage import execute, fetch_one, insert_and_get_id, row_to_dict

# Configuration
SECRET_KEY = "hackathon-super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

router = APIRouter(prefix="/auth", tags=["Authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    profession: str
    gst_registered: bool = False
    preferred_currency: str = "INR"

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/signup", response_model=Token)
async def signup(user_in: UserCreate):
    existing = fetch_one("SELECT * FROM users WHERE email = ?", (user_in.email,))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(user_in.password)
    now = datetime.utcnow().isoformat()
    
    user_id = insert_and_get_id(
        """
        INSERT INTO users (name, email, hashed_password, profession, gst_registered, preferred_currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_in.name, user_in.email, hashed_pw, user_in.profession, int(user_in.gst_registered), user_in.preferred_currency, now)
    )
    
    user_row = fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))
    user_dict = row_to_dict(user_row)
    
    access_token = create_access_token(data={"sub": user_in.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user_dict}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_row = fetch_one("SELECT * FROM users WHERE email = ?", (form_data.username,))
    if not user_row:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    user_dict = row_to_dict(user_row)
    if not verify_password(form_data.password, user_dict["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user_dict["email"]})
    return {"access_token": access_token, "token_type": "bearer", "user": user_dict}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user_row = fetch_one("SELECT * FROM users WHERE email = ?", (email,))
    if user_row is None:
        raise credentials_exception
    return row_to_dict(user_row)
