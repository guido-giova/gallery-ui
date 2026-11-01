export function initSizeSlider() {
    const GALLERY_MAX_COLUMNS = 20;
    const GALLERY_MIN_COLUMNS = 5;
    const GALLERY_DEFAULT_COLUMNS = 7;

    const slider = document.getElementById('amount-per-row');
    const sliderValue = document.getElementById('amount-per-row-value');
    const gallery = document.getElementById('gallery');

    slider.addEventListener('input', readSlider);

    function readSlider() {
        const columns = slider.value;
        document.cookie = `amount-per-row=${columns}; max-age=31536000; path=/; SameSite=Lax`;
        setValues(columns);
    }

    function cookieRestore() {
        const cookie = document.cookie
                                      .split("; ")
                                      .find((entry) => entry.startsWith("amount-per-row="));
        if (cookie) {
            const value = Number(cookie.split("=")[1]);
            if (Number.isInteger(value) && value >= GALLERY_MIN_COLUMNS && value <= GALLERY_MAX_COLUMNS) {
                return value;
            } else {
                return GALLERY_DEFAULT_COLUMNS;
            }
        } else {
            document.cookie = `amount-per-row=${GALLERY_DEFAULT_COLUMNS}; max-age=31536000; path=/; SameSite=Lax`;
            return GALLERY_DEFAULT_COLUMNS;
        }
    }

    function setValues(value) {
        slider.value = value;
        sliderValue.textContent = value;
        gallery.style.setProperty('--columns', value);
    }

    setValues(cookieRestore());
}
