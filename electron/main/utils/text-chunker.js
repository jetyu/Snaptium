export function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let startPos = 0;

  while (startPos < text.length) {
    const endPos = Math.min(startPos + chunkSize, text.length);
    const content = text.substring(startPos, endPos);

    chunks.push({
      content: content.trim(),
      startPos,
      endPos,
    });

    startPos += chunkSize - overlap;

    if (startPos <= chunks[chunks.length - 1].startPos) {
      startPos = chunks[chunks.length - 1].endPos;
    }
  }

  return chunks.filter(chunk => chunk.content.length > 0);
}


export function chunkMarkdown(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length === 0) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [{
      content: text.trim(),
      startPos: 0,
      endPos: text.length,
    }];
  }

  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let chunkStartPos = 0;
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWithNewline = line + '\n';
    const lineLength = lineWithNewline.length;

    if (currentChunk.length + lineLength > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        startPos: chunkStartPos,
        endPos: currentPos,
      });

      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + lineWithNewline;
      chunkStartPos = currentPos - overlapText.length;
    } else {
      currentChunk += lineWithNewline;
    }

    currentPos += lineLength;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startPos: chunkStartPos,
      endPos: currentPos,
    });
  }

  return chunks;
}
