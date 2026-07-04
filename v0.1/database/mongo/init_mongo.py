from pymongo import MongoClient
import json
import os

client = MongoClient("mongodb://localhost:27017/")
db = client["homepedia"]

# COLLECTION DEPARTEMENTS (GeoJSON)
print("Insertion des departements dans MongoDB...")
with open("data/raw/departements.geojson", "r", encoding="utf-8") as f:
    geojson = json.load(f)

collection = db["departements"]
collection.drop()

documents = []
for feature in geojson["features"]:
    doc = {
        "code": feature["properties"]["code"],
        "nom": feature["properties"]["nom"],
        "geometry": feature["geometry"]
    }
    documents.append(doc)

collection.insert_many(documents)
collection.create_index("code")
print(f"   {len(documents)} departements inseres !")

# COLLECTION REGIONS (GeoJSON)
print("Insertion des regions dans MongoDB...")
with open("data/raw/regions.geojson", "r", encoding="utf-8") as f:
    geojson = json.load(f)

collection = db["regions"]
collection.drop()

documents = []
for feature in geojson["features"]:
    doc = {
        "code": feature["properties"]["code"],
        "nom": feature["properties"]["nom"],
        "geometry": feature["geometry"]
    }
    documents.append(doc)

collection.insert_many(documents)
collection.create_index("code")
print(f"   {len(documents)} regions inserees !")

client.close()
print("\nMongoDB pret !")