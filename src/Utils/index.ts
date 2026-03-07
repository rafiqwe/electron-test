import { WebContents } from 'electron'

export const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function waitForLoad(wc: WebContents, timeout = 30000): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (): void => {
      wc.off('did-finish-load', handler)
      resolve()
    }

    wc.on('did-finish-load', handler)

    setTimeout(() => {
      wc.off('did-finish-load', handler)
      resolve()
    }, timeout)
  })
}

export async function waitForSelector(
  wc: WebContents,
  selector: string,
  timeout = 10000
): Promise<boolean> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const exists = await wc.executeJavaScript(
      `!!document.querySelector(${JSON.stringify(selector)})`,
      true
    )

    if (exists) return true
    await wait(500)
  }
  // id="_R_1h6kqsqppb6amH1_"

  return false
}

export async function typeLikeHuman(wc: WebContents, text: string): Promise<void> {
  wc.focus()
  console.log('running type like human', text)

  for (const char of text) {
    wc.sendInputEvent({ type: 'keyDown', keyCode: char })
    await wait(30)

    wc.sendInputEvent({ type: 'char', keyCode: char })
    await wait(30)

    wc.sendInputEvent({ type: 'keyUp', keyCode: char })
    await wait(50 + Math.random() * 100)
  }
}

export async function clickElementBySelector(wc: WebContents, selector: string): Promise<boolean> {
  console.log('[CLICK] Selector:', selector)

  const result = (await wc.executeJavaScript(
    `
    (function() {
      const el = document.querySelector("${selector.replace(/"/g, '\\"')}");
      if (!el) {
        console.log('[CLICK-DEBUG] Element not found');
        return false;
      }

      // Scroll into view if needed
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });

      // Give a tiny delay for scroll/focus
      setTimeout(() => {
        // Dispatch real MouseEvent (more reliable than .click() sometimes)
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0
        });
        el.dispatchEvent(clickEvent);

        // Also try native .click() as fallback
        el.click();
      }, 300);

      console.log('[CLICK-DEBUG] Click dispatched on element');
      return true;
    })();
    `,
    true
  )) as boolean

  if (result) {
    console.log('[CLICK] JS click dispatched successfully')
  } else {
    console.warn('[CLICK] Element not found or click failed')
  }

  return result
}
