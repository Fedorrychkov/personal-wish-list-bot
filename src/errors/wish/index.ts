export const codes = {
  WISH_BOOKED_SOMEBODY: 'WISH_BOOKED_SOMEBODY',
  WISH_NOT_FOUND: 'WISH_NOT_FOUND',
  WISH_PERMISSION_DENIED: 'WISH_PERMISSION_DENIED',
}

export const errors = {
  codes,
  messages: {
    [codes.WISH_BOOKED_SOMEBODY]: 'You can not change book status, because somebody is booked it before',
    [codes.WISH_NOT_FOUND]: 'Wish is not found',
    [codes.WISH_PERMISSION_DENIED]: 'You have not permission this wish',
  },
}
