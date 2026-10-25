import { useEffect, useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  format?: (value: number) => string
}

/** A slider paired with a number box, kept in sync: drag roughly, type exactly. */
export function SliderInput({ label, value, onChange, min, max, step = 1, format }: Props) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = (raw: string) => {
    const parsed = Number(raw)
    if (raw === '' || !Number.isFinite(parsed)) {
      setText(String(value))
      return
    }
    const next = Math.min(max, Math.max(min, step === 1 ? Math.round(parsed) : parsed))
    setText(String(next))
    onChange(next)
  }

  return (
    <label className="slider-input">
      <span>
        {label}: <strong>{format ? format(value) : value}</strong>
      </span>
      <div className="slider-input-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(event) => {
            const raw = event.target.value
            setText(raw)
            const parsed = Number(raw)
            if (raw !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max &&
              (step !== 1 || Number.isInteger(parsed))) {
              onChange(parsed)
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
          }}
        />
      </div>
    </label>
  )
}
