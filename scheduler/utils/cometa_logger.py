import logging, threading, re, os


class CometaLogger(logging.Logger):

    def __init__(self, name, level=logging.NOTSET):
        self._mask_words = []
        self._mask_words_lock = threading.Lock()
        return super(CometaLogger, self).__init__(name, level)

    def updateMaskWords(self, word_to_mask):
        self._mask_words_lock.acquire()
        self._mask_words.append(word_to_mask)
        self._mask_words_lock.release()

        return self._mask_words

    def mask_values(self, msg):
        words_to_mask = re.escape('@@'.join(self._mask_words))
        if words_to_mask:
            words_to_mask = words_to_mask.replace('@@', '|')
            msg = re.sub(rf"(?:{words_to_mask})\b", '[MASKED]', str(msg))
        return msg
