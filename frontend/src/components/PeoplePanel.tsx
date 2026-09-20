import { useState } from 'react'
import { api } from '../api'
import type { Person } from '../types'

const PRESET_COLOURS = ['#2f6fed', '#e0629b', '#28b487', '#f5a623', '#7c5cff']

interface Props {
  people: Person[]
  onChange: () => Promise<void>
}

export function PeoplePanel({ people, onChange }: Props) {
  const [name, setName] = useState('')
  const [colour, setColour] = useState(PRESET_COLOURS[0])
  const [error, setError] = useState<string | null>(null)

  const addPerson = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return
    if (people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A person named "${trimmed}" already exists.`)
      return
    }
    await api.people.create({ name: trimmed, colour })
    setName('')
    await onChange()
  }

  const removePerson = async (person: Person) => {
    if (
      !window.confirm(
        `Delete ${person.name}? This will also remove all of their incomes, expenses, transfers, savings plans, investments and accounts.`
      )
    ) {
      return
    }
    await api.people.remove(person.id)
    await onChange()
  }

  const updateName = async (person: Person, value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === person.name) return
    await api.people.update(person.id, { name: trimmed })
    await onChange()
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>People</h2>
        <p className="muted">
          Add or remove the people in your household. Incomes, expenses, transfers
          and savings are attached to a person.
        </p>

        {error && (
          <div className="card error" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Colour</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>
                  <input
                    defaultValue={person.name}
                    onBlur={async (event) => updateName(person, event.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    defaultValue={person.colour}
                    onBlur={async (event) => {
                      if (event.target.value !== person.colour) {
                        await api.people.update(person.id, { colour: event.target.value })
                        await onChange()
                      }
                    }}
                    style={{ width: 60, padding: 2, cursor: 'pointer' }}
                  />
                </td>
                <td>
                  <button className="danger" onClick={() => void removePerson(person)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form className="add-row" onSubmit={(event) => void addPerson(event)}>
          <input
            placeholder="New person name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            style={{ width: 'auto' }}
          >
            {PRESET_COLOURS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            style={{ width: 60, padding: 2, cursor: 'pointer' }}
          />
          <button type="submit">Add</button>
        </form>
      </section>
    </div>
  )
}
