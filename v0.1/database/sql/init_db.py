import psycopg2
import pandas as pd
import os

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="homepedia",
    user="postgres",
    password="homepedia123"
)
cur = conn.cursor()

# TABLE TRANSACTIONS
print("Creation de la table transactions...")
cur.execute("""
    DROP TABLE IF EXISTS transactions;
    CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        date_mutation DATE,
        nature_mutation VARCHAR(50),
        valeur_fonciere FLOAT,
        code_postal VARCHAR(10),
        nom_commune VARCHAR(100),
        code_departement VARCHAR(5),
        type_local VARCHAR(50),
        surface_reelle_bati FLOAT,
        nombre_pieces_principales FLOAT,
        longitude FLOAT,
        latitude FLOAT,
        prix_m2 FLOAT
    );
""")
conn.commit()
print("Table transactions creee !")

# TABLE STATS DEPARTEMENT
print("Creation de la table stats_departement...")
cur.execute("""
    DROP TABLE IF EXISTS stats_departement;
    CREATE TABLE stats_departement (
        id SERIAL PRIMARY KEY,
        code_departement VARCHAR(5),
        nb_transactions INT,
        prix_m2_moyen FLOAT,
        prix_m2_median FLOAT,
        prix_moyen FLOAT,
        surface_moyenne FLOAT
    );
""")
conn.commit()
print("Table stats_departement creee !")

# INSERTION DVF
print("Insertion des transactions (peut prendre 2-3 min)...")
df = pd.read_csv("data/cleaned/dvf_clean.csv", low_memory=False)
df = df.where(pd.notnull(df), None)

insert_query = """
    INSERT INTO transactions (
        date_mutation, nature_mutation, valeur_fonciere,
        code_postal, nom_commune, code_departement,
        type_local, surface_reelle_bati, nombre_pieces_principales,
        longitude, latitude, prix_m2
    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

batch_size = 5000
total = len(df)
for i in range(0, total, batch_size):
    batch = df.iloc[i:i+batch_size]
    records = [tuple(row) for row in batch.values]
    cur.executemany(insert_query, records)
    conn.commit()
    print(f"   {min(i+batch_size, total):,} / {total:,} lignes inserees...")

print("Transactions inserees !")

# INSERTION STATS
print("Insertion stats departement...")
stats = pd.read_csv("data/cleaned/stats_departement.csv")
stats = stats.where(pd.notnull(stats), None)
for _, row in stats.iterrows():
    cur.execute("""
        INSERT INTO stats_departement 
        (code_departement, nb_transactions, prix_m2_moyen, prix_m2_median, prix_moyen, surface_moyenne)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, tuple(row))
conn.commit()
print("Stats departement inserees !")

cur.close()
conn.close()
print("\nBase de donnees PostgreSQL prete !")