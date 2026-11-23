/** Freeze just the painted puppet and its prop before the asynchronous PNG encoding starts. */
export async function photographActor(player: Element | null) {
  const art = player?.querySelector<SVGGElement>('svg[data-puppet-stage] > [data-puppet-art]')
  if (!art) throw new Error('The stage is still loading. Try again in a moment.')
  const bounds = art.getBBox()
  const size = Math.max(320, bounds.width + 36, bounds.height + 36)
  const left = bounds.x + (bounds.width - size) / 2
  const top = bounds.y + (bounds.height - size) / 2
  const picture = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  picture.setAttribute('viewBox', [left, top, size, size].join(' '))
  picture.setAttribute('width', '560')
  picture.setAttribute('height', '560')
  picture.appendChild(art.cloneNode(true))
  const source = new Blob([new XMLSerializer().serializeToString(picture)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 560
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('The stage camera could not open. Try another browser.')
    context.fillStyle = '#f3efe1'
    context.fillRect(0, 0, 560, 560)
    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
