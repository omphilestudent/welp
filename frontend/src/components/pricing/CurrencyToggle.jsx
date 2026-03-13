import React from 'react';
import { FaGlobe, FaSync } from 'react-icons/fa';

const CurrencyToggle = ({
    countries = [],
    selectedCountry,
    onCountryChange,
    selectedCurrency,
    onCurrencyChange
}) => {
    const currencyOptions = Array.from(
        new Set(
            countries
                .map((country) => country.currency)
                .filter(Boolean)
        )
    );

    return (
        <div className="currency-toggle">
            <div className="currency-toggle__group">
                <label>
                    <FaGlobe /> Country
                </label>
                <select value={selectedCountry} onChange={(e) => onCountryChange?.(e.target.value)}>
                    {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                            {country.name} ({country.currency})
                        </option>
                    ))}
                </select>
            </div>
            <div className="currency-toggle__group">
                <label>
                    <FaSync /> Currency
                </label>
                <select value={selectedCurrency} onChange={(e) => onCurrencyChange?.(e.target.value)}>
                    {currencyOptions.map((currency) => (
                        <option key={currency} value={currency}>
                            {currency}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default CurrencyToggle;
