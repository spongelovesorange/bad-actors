/** Measure glyph ink in the tilted sign's own coordinates, including the ragged paper edge. */
export function measureCueInk() {
  const source = document.querySelector<HTMLHeadingElement>('.ba-fly-cue-title')!
  const paper = source.closest<HTMLElement>('.ba-fly-paper')!
  const copy = source.cloneNode(false) as HTMLHeadingElement
  const lineHeight = source.offsetHeight
  const text = source.textContent!
  const words = text.split(' ').map(word => {
    const span = document.createElement('span')
    span.style.whiteSpace = 'nowrap'
    const baseline = document.createElement('i')
    baseline.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;'
    span.append(baseline, word)
    return { word, span, baseline }
  })
  words.forEach(({ span }, i) => { if (i) copy.append(' '); copy.append(span) })
  source.replaceWith(copy)
  try {
    if (Math.abs(lineHeight - copy.offsetHeight) > 1) throw new Error('Ink measurement changed the original wrapping.')
    const style = getComputedStyle(copy)
    const canvas = document.createElement('canvas').getContext('2d')!
    canvas.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ')
    const width = paper.clientWidth, height = paper.clientHeight
    const clip = getComputedStyle(paper, '::before').clipPath
    const polygon = clip.slice('polygon('.length, -1).split(',').map(vertex =>
      vertex.trim().split(/\s+/).map((value, axis) => parseFloat(value) * (value.endsWith('%') ? (axis ? height : width) / 100 : 1)))
    const margins = words.flatMap(({ baseline, word }) => {
      const metrics = canvas.measureText(word)
      const x = copy.offsetLeft + baseline.offsetLeft, y = copy.offsetTop + baseline.offsetTop
      const left = x - metrics.actualBoundingBoxLeft, right = x + metrics.actualBoundingBoxRight
      const top = y - metrics.actualBoundingBoxAscent, bottom = y + metrics.actualBoundingBoxDescent
      return polygon.map(([ax, ay], i) => {
        const [bx, by] = polygon[(i + 1) % polygon.length]
        const dx = bx - ax, dy = by - ay
        return Math.min(...[[left,top], [right,top], [left,bottom], [right,bottom]]
          .map(([px,py]) => (dx * (py - ay) - dy * (px - ax)) / Math.hypot(dx, dy)))
      })
    })
    return {
      title: text, fontSize: parseFloat(style.fontSize), paperHeight: height,
      lines: new Set(words.map(({ baseline }) => baseline.offsetTop)).size,
      minInkClearance: Math.min(...margins),
    }
  } finally {
    copy.replaceWith(source)
  }
}
