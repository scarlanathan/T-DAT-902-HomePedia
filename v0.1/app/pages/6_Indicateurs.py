import streamlit as st
import pandas as pd
import plotly.express as px
import sys
sys.path.append("app")
from style import apply_style

st.set_page_config(page_title="Indicateurs - Homepedia", layout="wide")
apply_style()

st.markdown("""
<div style="
    background: linear-gradient(135deg, #ff6b2b 0%, #ffb347 100%);
    padding: 1.5rem 2rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
">
    <h1 style="color:white; margin:0; font-size:2rem;">Indicateurs socio-economiques</h1>
    <p style="color:rgba(255,255,255,0.85); margin:0.3rem 0 0;">Economie, Education, Emploi, Energie, Infrastructure, Environnement</p>
</div>
""", unsafe_allow_html=True)

@st.cache_data
def load_data():
    df = pd.read_csv("data/cleaned/stats_departement_complet.csv")
    df["code_departement"] = df["code_departement"].astype(str)
    return df

df = load_data()

# METRIQUES
col1, col2, col3, col4, col5, col6 = st.columns(6)
col1.metric("Revenu median moy.", f"{df['revenu_median'].mean():,.0f} €")
col2.metric("Chomage moyen", f"{df['taux_chomage'].mean():.1f} %")
col3.metric("Score education moy.", f"{df['score_education'].mean():.1f}")
col4.metric("Logements energivores", f"{df['pct_logements_energivores'].mean():.1f} %")
col5.metric("Score infrastructure", f"{df['score_infrastructure'].mean():.1f}")
col6.metric("Qualite air moyenne", f"{df['indice_qualite_air'].mean():.1f} / 100")

st.markdown("---")

tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "Economie", "Chomage", "Education", "Energie", "Infrastructure", "Environnement", "Correlations"
])

with tab1:
    st.subheader("Revenu median annuel par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "revenu_median")
        fig = px.bar(
            top, x="revenu_median", y="code_departement",
            orientation="h", color="revenu_median",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="revenu_median",
            labels={"revenu_median": "Revenu median (€)", "code_departement": "Dept"},
            title="Top 15 - Revenus les plus eleves"
        )
        fig.update_traces(texttemplate="%{text:,.0f}€", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="revenu_median", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"revenu_median": "Revenu median (€)", "prix_m2_moyen": "Prix m2 (€)"},
            title="Revenu median vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab2:
    st.subheader("Taux de chomage par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "taux_chomage")
        fig = px.bar(
            top, x="taux_chomage", y="code_departement",
            orientation="h", color="taux_chomage",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="taux_chomage",
            labels={"taux_chomage": "Taux chomage (%)", "code_departement": "Dept"},
            title="Top 15 - Chomage le plus eleve"
        )
        fig.update_traces(texttemplate="%{text:.1f}%", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="taux_chomage", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"taux_chomage": "Taux chomage (%)", "prix_m2_moyen": "Prix m2 (€)"},
            title="Chomage vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab3:
    st.subheader("Score education par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "score_education")
        fig = px.bar(
            top, x="score_education", y="code_departement",
            orientation="h", color="score_education",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="score_education",
            labels={"score_education": "Score education", "code_departement": "Dept"},
            title="Top 15 - Meilleur score education"
        )
        fig.update_traces(texttemplate="%{text:.0f}", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="score_education", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"score_education": "Score education", "prix_m2_moyen": "Prix m2 (€)"},
            title="Education vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab4:
    st.subheader("Logements energivores par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "pct_logements_energivores")
        fig = px.bar(
            top, x="pct_logements_energivores", y="code_departement",
            orientation="h", color="pct_logements_energivores",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="pct_logements_energivores",
            labels={"pct_logements_energivores": "% energivores", "code_departement": "Dept"},
            title="Top 15 - Plus de logements energivores"
        )
        fig.update_traces(texttemplate="%{text:.1f}%", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="pct_logements_energivores", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"pct_logements_energivores": "% energivores", "prix_m2_moyen": "Prix m2 (€)"},
            title="Energie vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab5:
    st.subheader("Score infrastructure par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "score_infrastructure")
        fig = px.bar(
            top, x="score_infrastructure", y="code_departement",
            orientation="h", color="score_infrastructure",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="score_infrastructure",
            labels={"score_infrastructure": "Score infra", "code_departement": "Dept"},
            title="Top 15 - Meilleure infrastructure"
        )
        fig.update_traces(texttemplate="%{text:.0f}", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="score_infrastructure", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"score_infrastructure": "Score infrastructure", "prix_m2_moyen": "Prix m2 (€)"},
            title="Infrastructure vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab6:
    st.subheader("Qualite de l air par departement")
    col1, col2 = st.columns(2)
    with col1:
        top = df.nlargest(15, "indice_qualite_air")
        fig = px.bar(
            top, x="indice_qualite_air", y="code_departement",
            orientation="h", color="indice_qualite_air",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            text="indice_qualite_air",
            labels={"indice_qualite_air": "Indice qualite air", "code_departement": "Dept"},
            title="Top 15 - Meilleure qualite de l air"
        )
        fig.update_traces(texttemplate="%{text:.0f}", textposition="outside")
        fig.update_layout(showlegend=False, plot_bgcolor="white",
                         paper_bgcolor="white", coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = px.scatter(
            df.dropna(), x="indice_qualite_air", y="prix_m2_moyen",
            size="population", hover_name="nom_departement",
            color="prix_m2_moyen",
            color_continuous_scale=["#ffb347", "#ff6b2b"],
            trendline="ols",
            labels={"indice_qualite_air": "Indice qualite air", "prix_m2_moyen": "Prix m2 (€)"},
            title="Environnement vs Prix immobilier"
        )
        fig.update_layout(plot_bgcolor="white", paper_bgcolor="white",
                         coloraxis_showscale=False, height=400)
        st.plotly_chart(fig, use_container_width=True)

with tab7:
    st.subheader("Matrice de correlation entre indicateurs et prix")
    corr_data = df[[
        "prix_m2_moyen", "revenu_median", "taux_chomage", "score_education",
        "pct_logements_energivores", "score_infrastructure",
        "indice_qualite_air", "population"
    ]].corr().round(2)

    fig = px.imshow(
        corr_data,
        color_continuous_scale=["white", "#ffb347", "#ff6b2b"],
        title="Matrice de correlation",
        text_auto=True,
        aspect="auto"
    )
    fig.update_layout(paper_bgcolor="white", height=500)
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.subheader("Tableau complet des indicateurs")
    st.dataframe(
        df[[
            "code_departement", "nom_departement", "prix_m2_moyen",
            "revenu_median", "taux_chomage", "score_education",
            "pct_logements_energivores", "score_infrastructure",
            "indice_qualite_air", "population"
        ]].sort_values("prix_m2_moyen", ascending=False).reset_index(drop=True),
        use_container_width=True,
        column_config={
            "code_departement": "Dept",
            "nom_departement": "Nom",
            "prix_m2_moyen": st.column_config.NumberColumn("Prix m2", format="%.0f €"),
            "revenu_median": st.column_config.NumberColumn("Revenu median", format="%d €"),
            "taux_chomage": st.column_config.NumberColumn("Chomage", format="%.1f %%"),
            "score_education": st.column_config.NumberColumn("Education", format="%.0f"),
            "pct_logements_energivores": st.column_config.NumberColumn("Energivores", format="%.1f %%"),
            "score_infrastructure": st.column_config.NumberColumn("Infrastructure", format="%.0f"),
            "indice_qualite_air": st.column_config.NumberColumn("Qualite air", format="%.0f"),
            "population": st.column_config.NumberColumn("Population", format="%d"),
        }
    )