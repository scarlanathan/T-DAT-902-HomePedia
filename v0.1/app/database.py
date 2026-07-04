import psycopg2
import pandas as pd
from pymongo import MongoClient
import streamlit as st

# POSTGRESQL
@st.cache_resource
def get_postgres_connection():
    return psycopg2.connect(
        host="localhost",
        port=5433,
        database="homepedia",
        user="postgres",
        password="homepedia123"
    )

@st.cache_data
def get_stats_departement():
    conn = get_postgres_connection()
    query = """
        SELECT 
            code_departement,
            nb_transactions,
            prix_m2_moyen,
            prix_m2_median,
            prix_moyen,
            surface_moyenne
        FROM stats_departement
        ORDER BY prix_m2_moyen DESC
    """
    return pd.read_sql(query, conn)

@st.cache_data
def get_transactions_by_dept(code_dept):
    conn = get_postgres_connection()
    query = """
        SELECT 
            date_mutation,
            valeur_fonciere,
            nom_commune,
            type_local,
            surface_reelle_bati,
            nombre_pieces_principales,
            prix_m2,
            latitude,
            longitude
        FROM transactions
        WHERE code_departement = %s
        LIMIT 1000
    """
    return pd.read_sql(query, conn, params=(code_dept,))

@st.cache_data
def get_stats_by_ville(nom_ville):
    conn = get_postgres_connection()
    query = """
        SELECT
            nom_commune,
            code_departement,
            COUNT(*) as nb_transactions,
            ROUND(AVG(prix_m2)::numeric, 2) as prix_m2_moyen,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_m2)::numeric, 2) as prix_m2_median,
            ROUND(AVG(valeur_fonciere)::numeric, 2) as prix_moyen,
            ROUND(AVG(surface_reelle_bati)::numeric, 2) as surface_moyenne
        FROM transactions
        WHERE LOWER(nom_commune) LIKE LOWER(%s)
        GROUP BY nom_commune, code_departement
        ORDER BY nb_transactions DESC
    """
    return pd.read_sql(query, conn, params=(f"%{nom_ville}%",))

@st.cache_data
def get_transactions_count():
    conn = get_postgres_connection()
    query = "SELECT COUNT(*) as total FROM transactions"
    result = pd.read_sql(query, conn)
    return result["total"].values[0]

# MONGODB
@st.cache_resource
def get_mongo_client():
    return MongoClient("mongodb://localhost:27017/")

@st.cache_data
def get_departements_geojson():
    client = get_mongo_client()
    db = client["homepedia"]
    docs = list(db["departements"].find({}, {"_id": 0}))
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"code": d["code"], "nom": d["nom"]},
                "geometry": d["geometry"]
            }
            for d in docs
        ]
    }
    return geojson

@st.cache_data
def get_regions_geojson():
    client = get_mongo_client()
    db = client["homepedia"]
    docs = list(db["regions"].find({}, {"_id": 0}))
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"code": d["code"], "nom": d["nom"]},
                "geometry": d["geometry"]
            }
            for d in docs
        ]
    }
    return geojson