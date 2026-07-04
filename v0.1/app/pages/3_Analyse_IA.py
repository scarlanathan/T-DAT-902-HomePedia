import streamlit as st
import pandas as pd
import plotly.express as px
from wordcloud import WordCloud
import matplotlib.pyplot as plt
from transformers import pipeline
import psycopg2
import sys
sys.path.append("app")
from style import apply_style
apply_style()

st.set_page_config(page_title="Analyse IA - Homepedia", layout="wide")
st.title("Analyse IA du marche immobilier")

@st.cache_data
def load_data():
    df = pd.read_csv("data/cleaned/spark_prix_ville.csv")
    return df

@st.cache_resource
def load_sentiment():
    return pipeline(
        "sentiment-analysis",
        model="nlptown/bert-base-multilingual-uncased-sentiment"
    )

df = load_data()

# SECTION 1 : Word Cloud des villes
st.subheader("Word Cloud des villes par volume de transactions")

dept_list = sorted(df["code_departement"].unique())
dept_select = st.selectbox("Choisir un departement", dept_list)

filtered = df[df["code_departement"] == dept_select]

text = " ".join(
    filtered.apply(
        lambda row: " ".join([row["nom_commune"]] * int(row["nb_transactions"] / 10 + 1)),
        axis=1
    ).tolist()
)

if text.strip():
    wc = WordCloud(
        width=800,
        height=400,
        background_color="white",
        colormap="Reds",
        max_words=50
    ).generate(text)

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.imshow(wc, interpolation="bilinear")
    ax.axis("off")
    st.pyplot(fig)
else:
    st.info("Pas assez de donnees pour ce departement")

st.markdown("---")

# SECTION 2 : Sentiment Analysis
st.subheader("Analyse de sentiment sur le marche immobilier")
st.markdown("Entrez un commentaire sur un bien ou une ville pour analyser le sentiment")

user_input = st.text_area(
    "Votre commentaire",
    placeholder="Ex: Bel appartement bien situe, quartier calme et agreable...",
    height=100
)

if st.button("Analyser le sentiment"):
    if user_input.strip():
        with st.spinner("Analyse en cours..."):
            try:
                sentiment_model = load_sentiment()
                result = sentiment_model(user_input[:512])[0]
                label = result["label"]
                score = result["score"]

                stars = int(label.split()[0])

                if stars >= 4:
                    sentiment = "Positif"
                    color = "green"
                elif stars == 3:
                    sentiment = "Neutre"
                    color = "orange"
                else:
                    sentiment = "Negatif"
                    color = "red"

                col1, col2, col3 = st.columns(3)
                col1.metric("Sentiment", sentiment)
                col2.metric("Note", f"{stars}/5 etoiles")
                col3.metric("Confiance", f"{score*100:.1f}%")

                st.markdown(f"**Interpretation** : Ce commentaire est considered comme **:{color}[{sentiment}]**")

            except Exception as e:
                st.error(f"Erreur : {e}")
    else:
        st.warning("Veuillez entrer un commentaire")

st.markdown("---")

# SECTION 3 : Analyse des prix par nombre de pieces
st.subheader("Distribution des prix par departement")

dept2 = st.selectbox("Departement", dept_list, key="dept2")
filtered2 = df[df["code_departement"] == dept2].nlargest(20, "nb_transactions")

fig = px.scatter(
    filtered2,
    x="nb_transactions",
    y="prix_m2_moyen",
    size="nb_transactions",
    color="prix_m2_moyen",
    hover_name="nom_commune",
    color_continuous_scale="Reds",
    labels={
        "nb_transactions": "Nombre de transactions",
        "prix_m2_moyen": "Prix m2 moyen (€)",
        "nom_commune": "Ville"
    },
    title=f"Prix vs Volume de transactions - Departement {dept2}"
)
st.plotly_chart(fig, use_container_width=True)