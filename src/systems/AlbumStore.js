// Какие позы уже найдены. Единственное, что игра помнит между запусками.
//
// localStorage может быть недоступен (приватный режим, запрет на данные
// сайтов), поэтому любое обращение обёрнуто: без сохранения игра работает,
// просто забывает найденное.

const KEY = 'cat-album-v1';

export class AlbumStore {
  constructor() {
    this.unlocked = new Set(this.load());
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.unlocked]));
    } catch (e) {
      /* без сохранения тоже играется */
    }
  }

  has(id) {
    return this.unlocked.has(id);
  }

  // Возвращает true, только если поза открыта впервые — по этому событию
  // показывается плашка «новая поза».
  unlock(id) {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    this.save();
    return true;
  }

  get count() {
    return this.unlocked.size;
  }
}
