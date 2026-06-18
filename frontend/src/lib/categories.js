// Canonical harm taxonomy, shared across every view so the UI never drifts from
// the backend contract.
export const CATEGORIES = [
  "hate_speech",
  "harassment",
  "spam",
  "misinformation",
  "graphic_violence",
  "adult_content",
  "self_harm",
]

export const CATEGORY_LABELS = {
  hate_speech: "Hate Speech",
  harassment: "Harassment",
  spam: "Spam",
  misinformation: "Misinformation",
  graphic_violence: "Graphic Violence",
  adult_content: "Adult Content",
  self_harm: "Self-Harm",
}

export const CATEGORY_BLURBS = {
  hate_speech: "Attacks based on protected identity",
  harassment: "Targeted bullying, threats, intimidation",
  spam: "Scams, bulk promotion, deceptive links",
  misinformation: "False or misleading factual claims",
  graphic_violence: "Gore or promotion of real-world violence",
  adult_content: "Sexually explicit material",
  self_harm: "Suicide or self-injury content",
}

export const PLATFORMS = [
  { slug: "kids", label: "Kids · strict" },
  { slug: "social", label: "Social Media · balanced" },
  { slug: "gaming", label: "Gaming · moderate" },
  { slug: "adult", label: "Adult 18+ · permissive" },
]
