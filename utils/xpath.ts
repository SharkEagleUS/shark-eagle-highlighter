/**
 * XPath utility functions for DOM element location
 */

/**
 * Get XPath for a DOM node
 */
export function getXPath(element: Node): string {
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentNode!;
  }

  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = element as Element;

  if (el.id) {
    return `//*[@id="${el.id}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousSibling;

    while (sibling) {
      if (
        sibling.nodeType === Node.ELEMENT_NODE &&
        (sibling as Element).tagName === current.tagName
      ) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Get element by XPath
 */
export function getElementByXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element;
  } catch {
    return null;
  }
}
