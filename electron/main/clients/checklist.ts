import { decodeHtml, stripHtml } from './parse'

/**
 * Разбор чек-листа заявки со страницы clients (/CheckList?id=...). Как и
 * остальной разбор — без Electron и состояния приложения, чтобы его можно было
 * проверить тестами на настоящей разметке.
 */

export interface ChecklistItem {
  id: number
  name: string
  description: string
  checked: boolean
  /** Кто отметил — clients показывает это только у выполненных. */
  checkedBy: string
  /** Как отмечено на странице: «11.08.2026, 13:56.00». Своего формата у clients нет. */
  checkedAt: string
  /** Раздел, к которому пункт относится; нужен при отправке отметки обратно. */
  category: string
}

export interface ChecklistGroup {
  /** Название раздела; пустая строка, если пункты лежат без него. */
  category: string
  items: ChecklistItem[]
}

function textOfElement(html: string, id: string): string {
  // Содержимое ищется по id, потому что классы в разметке повторяются, а
  // вложенность у разных пунктов отличается.
  const match = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</`, 'i'))
  return match ? stripHtml(match[1]) : ''
}

function parseItem(row: string): ChecklistItem | null {
  const idMatch = row.match(/id="trCheckListItem-(\d+)"/)
  if (!idMatch) return null
  const id = Number(idMatch[1])

  const icon = row.match(new RegExp(`<i[^>]*id="checkListIcon-${id}"[^>]*>`, 'i'))?.[0] ?? ''
  // Отмеченный пункт отличается иконкой: галочка вместо пустого кружка.
  const checked = /fa-check/.test(icon)
  const category = decodeHtml(icon.match(/toggleCheckboxText\(\s*\d+\s*,\s*'([^']*)'/)?.[1] ?? '')

  const userBlock = row.match(new RegExp(`id="checkListUser-${id}"[^>]*>([\\s\\S]*?)</div>`, 'i'))?.[1] ?? ''
  // Внутри — имя, <br /> и дата. Разделитель тегом, поэтому текст берётся частями.
  const userParts = stripHtml(userBlock.replace(/<br\s*\/?>/gi, '\n'))
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)
  const stamped = stripHtml(userBlock.replace(/<br\s*\/?>/gi, '|')).split('|').map(part => part.trim())

  return {
    id,
    name: textOfElement(row, `checkListName-${id}`),
    description: textOfElement(row, `checkListDescription-${id}`),
    checked,
    checkedBy: stamped[0] ?? userParts[0] ?? '',
    checkedAt: stamped[1] ?? '',
    category
  }
}

/**
 * Возвращает разделы в том порядке, в каком они идут на странице: у чек-листов
 * он осмысленный (01., 02., …), и пересортировка сбила бы смысл.
 */
export function parseChecklist(html: string): ChecklistGroup[] {
  const groups: ChecklistGroup[] = []
  if (!html || !html.includes('trCheckListItem-')) return groups

  // Раздел = заголовок <h4> и следующая за ним таблица пунктов.
  const blockPattern = /<h4>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4>|$)/gi
  let block: RegExpExecArray | null
  while ((block = blockPattern.exec(html)) !== null) {
    const category = stripHtml(block[1])
    const rows = block[2].match(/<tr id="trCheckListItem-\d+"[\s\S]*?<\/tr>/gi) ?? []
    const items = rows.map(parseItem).filter((item): item is ChecklistItem => item !== null)
    if (items.length > 0) groups.push({ category, items })
  }

  // Пункты без заголовка разделов иначе потерялись бы совсем.
  if (groups.length === 0) {
    const rows = html.match(/<tr id="trCheckListItem-\d+"[\s\S]*?<\/tr>/gi) ?? []
    const items = rows.map(parseItem).filter((item): item is ChecklistItem => item !== null)
    if (items.length > 0) groups.push({ category: '', items })
  }

  return groups
}

/** Шаблоны, которыми чек-лист заполняется, со страницы заявки. */
export interface ChecklistTemplate {
  id: number
  name: string
}

export function parseChecklistTemplates(ticketHtml: string): ChecklistTemplate[] {
  const found: ChecklistTemplate[] = []
  const pattern = /AddCheckListItemsFromTemplate\(\s*\d+\s*,\s*(\d+)\s*\)[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(ticketHtml)) !== null) {
    const id = Number(match[1])
    const name = stripHtml(match[2])
    if (id && name && !found.some(item => item.id === id)) found.push({ id, name })
  }
  return found
}
