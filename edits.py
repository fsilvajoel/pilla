def apply_edit(text: str, old: str, new: str, replace_all: bool = False) -> str:
    """
    Replaces an exact string occurrence in the given text.
    
    Args:
        text: The original text.
        old: The string to be replaced.
        new: The string to replace it with.
        replace_all: If True, replaces all occurrences. If False, replaces only the first.
        
    Returns:
        The modified text.
        
    Raises:
        ValueError: If 'old' is empty, not found, or if multiple occurrences exist when replace_all is False.
    """
    if not old:
        raise ValueError("A string vazia não pode ser pesquisada.")

    if old == new:
        raise ValueError("A string 'old' e 'new' não podem ser idênticas.")

    count = text.count(old)
    
    if count == 0:
        raise ValueError("não encontrado")
    
    if count > 1 and not replace_all:
        raise ValueError(f"O texto '{old}' foi encontrado {count} vezes. Use replace_all=True para substituir todos.")

    if replace_all:
        return text.replace(old, new)
    else:
        return text.replace(old, new, 1)
