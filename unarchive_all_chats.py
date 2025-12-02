#!/usr/bin/env python3
"""
Script to unarchive all chats in the database
Run this script to remove is_archived flag from all chats
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "chatapp")

def unarchive_all_chats():
    """Unarchive all chats in the database"""
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Update all chats with is_archived: True to is_archived: False
        result = db.chats.update_many(
            {"is_archived": True},
            {"$set": {"is_archived": False}}
        )
        
        print(f"✅ Successfully unarchived {result.modified_count} chats")
        return result.modified_count
    except Exception as e:
        print(f"❌ Error unarchiving chats: {e}")
        return 0
    finally:
        client.close()

if __name__ == "__main__":
    print("🔄 Unarchiving all chats...")
    count = unarchive_all_chats()
    print(f"✨ Done! {count} chats unarchived.")
