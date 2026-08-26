/**
 * Кому показывать пункт «Админ» в боковой панели.
 *
 * Это только видимость меню - настоящая проверка прав живёт на guard-сервере
 * (`server/guard/`, `ADMIN_ZAMMAD_USER_IDS`). Даже если кто-то откроет этот
 * экран в обход интерфейса, сервер откажет любому, кого нет в своём списке.
 */
export const ADMIN_ZAMMAD_USER_IDS = [126213]

export function isAdminUser(userId: number | undefined | null): boolean {
  return !!userId && ADMIN_ZAMMAD_USER_IDS.includes(userId)
}
