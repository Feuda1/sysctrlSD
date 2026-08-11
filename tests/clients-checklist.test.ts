import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseChecklist, parseChecklistTemplates } from '../electron/main/clients/checklist'

// Настоящий фрагмент со страницы clients: разметку чек-листа мы не придумываем,
// а разбираем, поэтому проверять надо именно на ней.
const fragment = readFileSync(join(__dirname, 'fixtures', 'clients-checklist.html'), 'utf8')

describe('parseChecklist', () => {
  const groups = parseChecklist(fragment)

  it('раскладывает пункты по разделам в порядке страницы', () => {
    expect(groups.length).toBe(2)
    expect(groups[0].category).toBe('02. Обустроить рабочее место')
    expect(groups[0].items).toHaveLength(3)
  })

  it('читает название и описание пункта', () => {
    const item = groups[0].items[0]
    expect(item.id).toBe(67726)
    expect(item.name).toBe('Настроить фильтры в ztest')
    expect(item.description).toContain('Ссылка на обучение')
  })

  it('видит выполненный пункт и кем он отмечен', () => {
    const done = groups.flatMap(group => group.items).find(item => item.checked)
    expect(done).toBeDefined()
    expect(done!.checkedBy).toBe('Глущенко Иван')
    expect(done!.checkedAt).toContain('11.08.2026')
  })

  it('невыполненные пункты остаются без отметки', () => {
    const open = groups.flatMap(group => group.items).filter(item => !item.checked)
    expect(open.length).toBeGreaterThan(0)
    expect(open.every(item => item.checkedBy === '')).toBe(true)
  })

  it('запоминает раздел пункта — его требует сервер при отметке', () => {
    expect(groups[0].items[0].category).not.toBe('')
  })

  it('сохраняет переносы строк в описании', () => {
    const row = `
      <tr id="trCheckListItem-42">
        <i id="checkListIcon-42" onclick="toggleCheckboxText(42, 'Раздел');"></i>
        <div id="checkListName-42">Пункт</div>
        <small id="checkListDescription-42">Первая строка<br/>Вторая строка</small>
      </tr>`
    const item = parseChecklist(row)[0].items[0]
    expect(item.description).toBe('Первая строка\nВторая строка')
  })

  it('на пустом чек-листе отдаёт пустой список, а не падает', () => {
    expect(parseChecklist('<div class="slimscroll"></div>')).toEqual([])
    expect(parseChecklist('')).toEqual([])
  })
})

describe('parseChecklistTemplates', () => {
  it('находит шаблоны в меню страницы заявки', () => {
    const html = `
      <a class="dropdown-item" onclick="AddCheckListItemsFromTemplate(616064, 1)">&#x41D;&#x43E;&#x432;&#x430;&#x44F; &#x442;&#x43E;&#x447;&#x43A;&#x430;</a>
      <a class="dropdown-item" onclick="AddCheckListItemsFromTemplate(616064, 3)">&#x427;&#x435;&#x43A;-&#x43B;&#x438;&#x441;&#x442; &#x43D;&#x43E;&#x432;&#x438;&#x447;&#x43A;&#x430;</a>
      <a class="dropdown-item" onclick="AddCheckListItemsFromTemplate(616064, 3)">повтор</a>
    `
    expect(parseChecklistTemplates(html)).toEqual([
      { id: 1, name: 'Новая точка' },
      { id: 3, name: 'Чек-лист новичка' }
    ])
  })

  it('без меню шаблонов возвращает пустой список', () => {
    expect(parseChecklistTemplates('<div>ничего</div>')).toEqual([])
  })
})
