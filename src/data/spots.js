// ТАБЛИЦА МЕСТ ДЛЯ СНА — главный файл данных.
// Добавление нового места = одна строка здесь, без правок логики.
// Ни одна система не должна знать про конкретные id: всё работает перебором.
//
// pose    — имя позы из SLEEP_POSES; три анимации (укладывание, сон,
//           пробуждение) выводятся из него автоматически.
// surface — высота поверхности над полом; 0 — лечь прямо на пол.
// availableFrom/To — окно игрового времени, может пересекать полночь.
// Место вне своего окна не исчезает: сердечко над ним гаснет до призрака,
// а под ним идёт обратный отсчёт до открытия (см. SpotMarkers).

export const SPOTS = [
  {
    id: 'radiator',
    label: 'Батарея',
    poseLabel: 'Клубком',
    x: 350,
    surface: 0,
    facing: 'left',
    pose: 'curl',
    availableFrom: 18,
    availableTo: 6, // тепло держится всю ночь
    comfort: 5,
    hint: 'Тёплая батарея',
  },
  {
    id: 'floor-puddle',
    label: 'Коврик',
    poseLabel: 'Растёкся',
    x: 640,
    surface: 0,
    facing: 'right',
    pose: 'liquid',
    availableFrom: 0,
    availableTo: 24, // доступно всегда
    comfort: 2,
    hint: 'Просто лечь',
  },
  {
    id: 'windowsill',
    label: 'Комод под окном',
    poseLabel: 'Батон',
    x: 1290,
    surface: 118, // высота комода
    facing: 'right',
    pose: 'loaf',
    availableFrom: 8,
    availableTo: 16, // солнечное пятно уходит после четырёх
    comfort: 3,
    hint: 'Погреться на солнце',
  },
  {
    id: 'sofa',
    label: 'Диван',
    poseLabel: 'Кверху пузом',
    x: 1980,
    surface: 96, // высота сиденья
    facing: 'left',
    pose: 'belly',
    availableFrom: 12,
    availableTo: 22,
    comfort: 4,
    hint: 'Мягкое место',
  },
];
