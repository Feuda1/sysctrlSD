import { describe, expect, it } from 'vitest'
import {
  clientsFormErrorMessage,
  extractSelectedOptions,
  isClientsCreateForm,
  isClientsLoginPage,
  parseClientsScoreControl,
  stripHtml,
  ticketIdFromUrl
} from '../electron/main/clients/parse'

// Markup shapes below are trimmed copies of real clients pages.
const SCORE_SELECT = `
  <div>
    <label class="text-muted font-10">БАЛЛЫ ЗА ЗАЯВКУ</label>
    <select class="form-select mb-3" id="ticket_Score" name="ticket.Score">
      <option value="00.0"> 0 баллов</option>
      <option value="00.5"> 00,5 балла</option>
      <option value="00"> Без оценки</option>
      <option selected value="01.0"> 01 балл</option>
      <option value="01.5"> 01,5 балла</option>
    </select>
  </div>`

const SCORE_SELECT_READONLY = SCORE_SELECT.replace('id="ticket_Score" name="ticket.Score"', 'disabled')

// The history table mentions the same words in a different case, and it comes
// earlier on the page than the control itself.
const HISTORY_BEFORE_CONTROL = `
  <table>
    <tr><td>10.08.2026 11:40</td><td><div>Баллы за заявку</div></td><td>01.0</td></tr>
  </table>
  <select id="newArticleType">
    <option value="note">Заметка</option>
    <option value="email">E-mail</option>
  </select>
  ${SCORE_SELECT}`

describe('parseClientsScoreControl', () => {
  it('reads options and the selected value', () => {
    const control = parseClientsScoreControl(SCORE_SELECT)
    expect(control.options).toHaveLength(5)
    expect(control.value).toBe('01.0')
    expect(control.options[2]).toEqual({ value: '00', label: 'Без оценки' })
  })

  it('treats a disabled select as read-only', () => {
    expect(parseClientsScoreControl(SCORE_SELECT).canEdit).toBe(true)
    expect(parseClientsScoreControl(SCORE_SELECT_READONLY).canEdit).toBe(false)
  })

  it('skips the history row and finds the real control', () => {
    const control = parseClientsScoreControl(HISTORY_BEFORE_CONTROL)
    expect(control.value).toBe('01.0')
    expect(control.options.map(o => o.value)).not.toContain('note')
  })

  it('refuses a select whose options are not score codes', () => {
    const wrong = `<label>БАЛЛЫ ЗА ЗАЯВКУ</label><select><option value="note">Заметка</option></select>`
    const control = parseClientsScoreControl(wrong)
    expect(control.options).toHaveLength(0)
    expect(control.unrecognised).toBe(true)
  })

  it('returns nothing when the page has no such control', () => {
    expect(parseClientsScoreControl('<div>ничего</div>').options).toHaveLength(0)
    expect(parseClientsScoreControl('').canEdit).toBe(false)
  })
})

describe('isClientsLoginPage', () => {
  it('recognises the login form', () => {
    expect(isClientsLoginPage('<form action="/Account/Login"><input name="password"></form>')).toBe(true)
  })

  it('does not treat a mere link as the login page', () => {
    // This false positive used to fail the login of perfectly fine accounts.
    expect(isClientsLoginPage('<a href="/Account/Login">Выход</a><h1>Профиль</h1>')).toBe(false)
  })
})

describe('helpers', () => {
  it('finds the ticket id in a details url', () => {
    expect(ticketIdFromUrl('https://clients.denvic.ru/Tickets/Details/616943')).toBe(616943)
    expect(ticketIdFromUrl('https://clients.denvic.ru/Tickets/Create')).toBeNull()
  })

  it('detects the create form by its caption field', () => {
    expect(isClientsCreateForm('<input id="newCaption">')).toBe(true)
    expect(isClientsCreateForm('<div>Заявка</div>')).toBe(false)
  })

  it('reads a validation message', () => {
    const html = '<div class="validation-summary-errors"><ul><li>Неправильный логин</li></ul></div>'
    expect(clientsFormErrorMessage(html)).toBe('Неправильный логин')
    expect(clientsFormErrorMessage('<div>ок</div>')).toBeNull()
  })

  it('strips tags and decodes entities', () => {
    expect(stripHtml('<b>Иван</b>&nbsp;&#x41F;&#x435;&#x442;&#x440;&#x43E;&#x432;')).toBe('Иван Петров')
  })

  it('takes only selected options', () => {
    const html = '<select id="ticket_tags"><option value="a" selected>A</option><option value="b">B</option></select>'
    expect(extractSelectedOptions(html, 'ticket_tags')).toEqual(['a'])
  })
})
