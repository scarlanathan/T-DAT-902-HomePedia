import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5433,
    database="homepedia",
    user="postgres",
    password="homepedia123"
)
cur = conn.cursor()

print("Creation des index...")

indexes = [
    "CREATE INDEX IF NOT EXISTS idx_transactions_dept ON transactions(code_departement);",
    "CREATE INDEX IF NOT EXISTS idx_transactions_commune ON transactions(nom_commune);",
    "CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type_local);",
    "CREATE INDEX IF NOT EXISTS idx_transactions_prix ON transactions(prix_m2);",
    "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date_mutation);",
    "CREATE INDEX IF NOT EXISTS idx_transactions_code_postal ON transactions(code_postal);",
    "CREATE INDEX IF NOT EXISTS idx_stats_dept ON stats_departement(code_departement);",
]

for idx in indexes:
    cur.execute(idx)
    print(f"OK - {idx.split('idx_')[1].split(' ')[0]}")

conn.commit()
cur.close()
conn.close()
print("\nTous les index crees !")