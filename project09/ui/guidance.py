"""Short action guidance shared by the four planning steps."""
from html import escape
import streamlit as st


def action_guide(title: str, instruction: str, next_step: str) -> None:
    st.markdown(
        '<section class="p09-action-guide"><div class="p09-guide-icon" aria-hidden="true">→</div><div>'
        f'<strong>{escape(title)}</strong><p>{escape(instruction)}</p>'
        f'<small>{escape(next_step)}</small></div></section>',
        unsafe_allow_html=True,
    )
