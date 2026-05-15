type BrowserLike = {
  newPage: (options?: any) => Promise<any>
  close: () => Promise<void>
}

type PlaywrightLike = {
  chromium: {
    launch: (options?: any) => Promise<BrowserLike>
  }
}

async function loadPlaywright(): Promise<PlaywrightLike> {
  const dynamicImport = (specifier: string) => import(/* webpackIgnore: true */ specifier)

  try {
    return await dynamicImport('playwright') as PlaywrightLike
  } catch {
    try {
      return await dynamicImport('playwright-core') as PlaywrightLike
    } catch {
      throw new Error('Playwright is not installed. Run npm install after pulling these changes.')
    }
  }
}

export async function renderHtmlToPdfBuffer(html: string) {
  const playwright = await loadPlaywright()
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    undefined

  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
    })

    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.emulateMedia({ media: 'print' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
