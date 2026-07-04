import streamlit as st
import pandas as pd
import plotly.express as px
import sys
sys.path.append("app")
from style import apply_style
from database import get_stats_by_ville, get_stats_departement, get_transactions_by_dept

st.set_page_config(page_title="Recherche - Homepedia", layout="wide")
apply_style()

st.markdown("""
<div style="
    background: linear-gradient(135deg, #ff6b2b 0%, #ffb347 100%);
    padding: 1.5rem 2rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
">
    <h1 style="color:white; margin:0; font-size:2rem;">Recherche par ville</h1>
    <p style="color:rgba(255,255,255,0.85); margin:0.3rem 0 0;">Requetes en temps reel sur PostgreSQL</p>
</div>
""", unsafe_allow_html=True)

dept = get_stats_departement()
dept["code_departement"] = dept["code_departement"].astype(str)

# RECHERCHE PAR VILLE
st.subheader("Rechercher une ville")
col1, col2 = st.columns(2)
with col1:
    search = st.text_input("Nom de la ville", placeholder="Ex: Paris, Lyon, Bordeaux...")
with col2:
    dept_filter = st.selectbox(
        "Filtrer par departement (optionnel)",
        ["Tous"] + sorted(dept["code_departement"].unique().tolist())
    )

if search and len(search) >= 2:
    with st.spinner("Recherche dans PostgreSQL..."):
        results = get_stats_by_ville(search)
        if dept_filter != "Tous":
            results = results[results["code_departement"].astype(str) == dept_filter]

    if len(results) > 0:
        st.markdown(f"**{len(results)} ville(s) trouvee(s) dans PostgreSQL**")
        st.dataframe(
            results.reset_index(drop=True),
            use_container_width=True,
            column_config={
                "nom_commune": "Ville",
                "code_departement": "Departement",
                "prix_m2_moyen": st.column_config.NumberColumn("Prix m2 moyen", format="%.0f €"),
                "prix_m2_median": st.column_config.NumberColumn("Prix m2 median", format="%.0f €"),
                "nb_transactions": st.column_config.NumberColumn("Transactions", format="%d"),
                "prix_moyen": st.column_config.NumberColumn("Prix moyen", format="%.0f €"),
                "surface_moyenne": st.column_config.NumberColumn("Surface moy.", format="%.0f m2"),
            }
        )

        st.markdown("---")
        st.subheader("Detail d'une ville")
        ville_select = st.selectbox(
            "Choisir une ville",
            results["nom_commune"].tolist()
        )

        ville_data = results[results["nom_commune"] == ville_select].iloc[0]
        dept_data = dept[dept["code_departement"] == str(ville_data["code_departement"])]
        national_avg = dept["prix_m2_moyen"].mean()

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Prix m2 moyen", f"{ville_data['prix_m2_moyen']:.0f} €")
        col2.metric("Prix m2 median", f"{ville_data['prix_m2_median']:.0f} €")
        col3.metric("Transactions", f"{ville_data['nb_transactions']:,.0f}")
        col4.metric("Surface moyenne", f"{ville_data['surface_moyenne']:.0f} m2")

        st.markdown("---")
        st.subheader(f"Comparaison : {ville_select} vs Departement vs National")
        compare_data = pd.DataFrame({
            "Niveau": [
                ville_select,
                f"Dept {ville_data['code_departement']}",
                "National"
            ],
            "Prix m2 moyen": [
                ville_data["prix_m2_moyen"],
                dept_data["prix_m2_moyen"].values[0] if len(dept_data) > 0 else 0,
                national_avg
            ]
        })
        fig = px.bar(
            compare_data,
            x="Niveau",
            y="Prix m2 moyen",
            color="Niveau",
            color_discrete_sequence=["#ff6b2b", "#ffb347", "#ffd700"],
            text="Prix m2 moyen"
        )
        fig.update_traces(texttemplate="%{text:.0f} €", textposition="outside")
        fig.update_layout(
            showlegend=False,
            plot_bgcolor="white",
            paper_bgcolor="white",
            font_color="#1c1c1c",
            xaxis=dict(gridcolor="#f0f0f0"),
            yaxis=dict(gridcolor="#f0f0f0"),
            height=350
        )
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("---")
        st.subheader(f"Transactions recentes - {ville_select} (depuis PostgreSQL)")
        with st.spinner("Chargement depuis PostgreSQL..."):
            transactions = get_transactions_by_dept(str(ville_data["code_departement"]))
            transactions_ville = transactions[
                transactions["nom_commune"].str.lower() == ville_select.lower()
            ]

        if len(transactions_ville) > 0:
            st.dataframe(
                transactions_ville.head(20).reset_index(drop=True),
                use_container_width=True,
                column_config={
                    "date_mutation": "Date",
                    "valeur_fonciere": st.column_config.NumberColumn("Prix", format="%.0f €"),
                    "type_local": "Type",
                    "surface_reelle_bati": st.column_config.NumberColumn("Surface", format="%.0f m2"),
                    "nombre_pieces_principales": st.column_config.NumberColumn("Pieces", format="%d"),
                    "prix_m2": st.column_config.NumberColumn("Prix m2", format="%.0f €"),
                }
            )
        else:
            st.info("Pas de transactions disponibles pour cette ville")
    else:
        st.info("Aucune ville trouvee. Essayez un autre nom.")
else:
    st.info("Entrez au moins 2 caracteres pour rechercher")

st.markdown("---")

# COMPARAISON DEPARTEMENTS
st.subheader("Comparer des departements")
dept_multi = st.multiselect(
    "Choisir des departements",
    sorted(dept["code_departement"].unique().tolist()),
    default=["75", "69", "13", "33"]
)

if dept_multi:
    dept_compare = dept[dept["code_departement"].isin(dept_multi)]
    col1, col2 = st.columns(2)

    with col1:
        fig = px.bar(
            dept_compare,
            x="code_departement",
            y="prix_m2_moyen",
            color="code_departement",
            color_discrete_sequence=["#ff6b2b", "#ffb347", "#ffd700", "#ff8c55"],
            labels={"prix_m2_moyen": "Prix m2 moyen (€)", "code_departement": "Departement"},
            title="Prix m2 moyen"
        )
        fig.update_layout(
            showlegend=False,
            plot_bgcolor="white",
            paper_bgcolor="white",
            font_color="#1c1c1c"
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig = px.bar(
            dept_compare,
            x="code_departement",
            y="nb_transactions",
            color="code_departement",
            color_discrete_sequence=["#ff6b2b", "#ffb347", "#ffd700", "#ff8c55"],
            labels={"nb_transactions": "Nombre de transactions", "code_departement": "Departement"},
            title="Volume de transactions"
        )
        fig.update_layout(
            showlegend=False,
            plot_bgcolor="white",
            paper_bgcolor="white",
            font_color="#1c1c1c"
        )
        st.plotly_chart(fig, use_container_width=True)