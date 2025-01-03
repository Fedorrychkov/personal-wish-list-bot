export const codes = {
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_FINISHED: 'GAME_FINISHED',
  GAME_ALREADY_PARTICIPANT: 'GAME_ALREADY_PARTICIPANT',
  GAME_YOU_CANT_ADD_YOURSELF: 'GAME_YOU_CANT_ADD_YOURSELF',
  GAME_YOU_CANT_MUTATE: 'GAME_YOU_CANT_MUTATE',
  GAME_NOT_ENOUGH_PARTICIPANTS: 'GAME_NOT_ENOUGH_PARTICIPANTS',
}

export const errors = {
  codes,
  messages: {
    [codes.GAME_NOT_FOUND]: 'Игра не найдена, обратитесь к создателю игры или администратору бота',
    [codes.GAME_FINISHED]: 'Игра уже завершена, обратитесь к создателю игры, если произошла ошибка',
    [codes.GAME_ALREADY_PARTICIPANT]: 'Вы уже участвуете в этой игре',
    [codes.GAME_YOU_CANT_ADD_YOURSELF]:
      'Вы не можете добавить себя в игру, так как вы создатель игры и уже участвуете в ней',
    [codes.GAME_YOU_CANT_MUTATE]: 'Вы не можете изменить эту игру, так как вы не создатель игры',
    [codes.GAME_NOT_ENOUGH_PARTICIPANTS]: 'Недостаточно участников для начала игры',
  },
}
