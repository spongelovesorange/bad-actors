/** The lip of the raised stage separates the lit boards from the dark front stalls. */
export function FrontRowRail() {
  return <svg className="ba-stage-apron" aria-hidden="true" focusable="false" viewBox="0 0 1000 80" preserveAspectRatio="none">
    <path d="m0 2 235 1 198-2 216 1 181-2 170 1v79H0Z" fill="#372b26" />
    <path d="m0 2 235 1 198-2 216 1 181-2 170 1v17l-110 3-225-2-212 2-261-1L0 22Z" fill="#70513b" stroke="#443226" strokeWidth="2" />
    <path d="m2 6 208-1 237 1 232-1 146 1 171-2" fill="none" stroke="#c39a67" strokeWidth="2.5" />
    <g fill="none" strokeLinecap="round">
      <path d="m12 15 92-2m28 1 69-3m24 1 82 2m97 3 54-3 81-.5m87-3 97 2m146 1 108-4" stroke="#a67a51" strokeWidth="1.4" />
      <path d="m57 18 66-2m123 0 34 1m284-1 41-2m126 5 59-3m69 1 48-3" stroke="#49372b" />
    </g>
    {/* The floor below the stage recedes toward the toe board; its seams stay below the boots. */}
    <path d="M0 24 1000 19v61H0Z" fill="#4b3a2e" />
    <path d="M201 23 142 80m230-57-22 57m169-59 8 59m120-58 50 58m90-60 98 60" fill="none" stroke="#352c25" strokeWidth="2" />
    <path d="M203 26 150 80m225-56-19 56m335-57 49 55" stroke="#6a503d" fill="none" />
    <path d="m0 73 230-4 388 3 382-5v13H0Z" fill="#2d2320" />
    <path d="m0 66 197-4 40 2 30 14-267 2Z" fill="#604736" stroke="#322821" strokeWidth="2" />
    <path d="m5 68 188-4 40 2" fill="none" stroke="#9b7752" strokeWidth="1.6" />
    {/* Empty seats at the outer edges of the house. Stubbs has his own folding chair. */}
    <g fill="#683831" stroke="#302523" strokeWidth="2.5">
      <path d="M-10 82 0 56q2-6 13-5l35 7q5 1 4 7l-4 15Z" />
      <path d="m907 82 6-20q2-6 9-8l36-4q9-1 12 6l9 26Z" />
    </g>
    <path d="m3 57 10-2 31 6m875-3 38-5" fill="none" stroke="#ac6856" strokeWidth="2" strokeLinecap="round" />
    <g fill="#ac936f" stroke="#382a24" strokeWidth="1.4">
      <circle cx="160" cy="12" r="2" /><circle cx="430" cy="13" r="2" /><circle cx="735" cy="12" r="2" />
    </g>
  </svg>
}
