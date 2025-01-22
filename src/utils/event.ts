export class NodeEventDispatcher {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addEventListener(type: string, callback: (event: any) => void) {
    return undefined
  }

  dispatchEvent() {
    return Promise.resolve()
  }
}
