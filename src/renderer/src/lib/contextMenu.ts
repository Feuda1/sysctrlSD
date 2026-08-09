export interface ContextMenuItem {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
}

/**
 * Shows a native context menu and resolves with the id of the chosen item.
 * The menu is built here because only the renderer knows what was right-clicked;
 * the main process just paints it.
 */
export async function showContextMenu(items: ContextMenuItem[]): Promise<string | null> {
  const usable = items.filter(item => item.type === 'separator' || (item.id && item.label))
  if (usable.length === 0) return null
  return window.api.app.showContextMenu(usable)
}

export function separator(): ContextMenuItem {
  return { type: 'separator' }
}
