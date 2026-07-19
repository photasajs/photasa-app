//! 与 Electron `calculateDebounceTime` 一致

pub fn calculate_debounce_ms(pending_count: usize) -> u64 {
    if pending_count > 1000 {
        50
    } else if pending_count > 100 {
        100
    } else {
        200
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debounce_ms_tiers() {
        assert_eq!(calculate_debounce_ms(2000), 50);
        assert_eq!(calculate_debounce_ms(500), 100);
        assert_eq!(calculate_debounce_ms(50), 200);
    }
}
