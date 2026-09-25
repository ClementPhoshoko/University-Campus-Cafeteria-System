import { useEffect, useRef, useState } from 'react';

export default function useObjectPreview(initialValue = null) {
  const [preview, setPreview] = useState(initialValue);
  const currentRef = useRef(preview);
  currentRef.current = preview;

  const setPreviewFromFile = (file) => {
    if (!file) {
      setPreview(initialValue);
      return;
    }
    const previous = currentRef.current;
    if (previous && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
    setPreview(URL.createObjectURL(file));
  };

  useEffect(
    () => () => {
      const current = currentRef.current;
      if (current && current.startsWith('blob:')) URL.revokeObjectURL(current);
    },
    [],
  );

  return [preview, setPreviewFromFile];
}