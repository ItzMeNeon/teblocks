export interface Country {
	code: string;
	name: string;
	flag: string;
}

export const COUNTRIES: Country[] = [
	{ code: 'US', name: 'United States', flag: '🇺🇸' },
	{ code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
	{ code: 'JP', name: 'Japan', flag: '🇯🇵' },
	{ code: 'KR', name: 'South Korea', flag: '🇰🇷' },
	{ code: 'CA', name: 'Canada', flag: '🇨🇦' },
	{ code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
	{ code: 'DE', name: 'Germany', flag: '🇩🇪' },
	{ code: 'FR', name: 'France', flag: '🇫🇷' },
	{ code: 'AU', name: 'Australia', flag: '🇦🇺' },
	{ code: 'BR', name: 'Brazil', flag: '🇧🇷' },
	{ code: 'MX', name: 'Mexico', flag: '🇲🇽' },
	{ code: 'ES', name: 'Spain', flag: '🇪🇸' },
	{ code: 'IT', name: 'Italy', flag: '🇮🇹' },
	{ code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
	{ code: 'SE', name: 'Sweden', flag: '🇸🇪' },
	{ code: 'NO', name: 'Norway', flag: '🇳🇴' },
	{ code: 'FI', name: 'Finland', flag: '🇫🇮' },
	{ code: 'DK', name: 'Denmark', flag: '🇩🇰' },
	{ code: 'PL', name: 'Poland', flag: '🇵🇱' },
	{ code: 'SG', name: 'Singapore', flag: '🇸🇬' },
	{ code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
	{ code: 'TH', name: 'Thailand', flag: '🇹🇭' },
	{ code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
	{ code: 'PH', name: 'Philippines', flag: '🇵🇭' },
	{ code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
	{ code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
	{ code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
	{ code: 'AR', name: 'Argentina', flag: '🇦🇷' },
	{ code: 'CL', name: 'Chile', flag: '🇨🇱' },
	{ code: 'CO', name: 'Colombia', flag: '🇨🇴' },
	{ code: 'PE', name: 'Peru', flag: '🇵🇪' },
	{ code: 'AT', name: 'Austria', flag: '🇦🇹' },
	{ code: 'BE', name: 'Belgium', flag: '🇧🇪' },
	{ code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
	{ code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
	{ code: 'IE', name: 'Ireland', flag: '🇮🇪' },
	{ code: 'PT', name: 'Portugal', flag: '🇵🇹' },
	{ code: 'RU', name: 'Russia', flag: '🇷🇺' },
	{ code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
	{ code: 'TR', name: 'Turkey', flag: '🇹🇷' },
	{ code: 'IN', name: 'India', flag: '🇮🇳' },
	{ code: 'IL', name: 'Israel', flag: '🇮🇱' },
	{ code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
	{ code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
	{ code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
	{ code: 'EG', name: 'Egypt', flag: '🇪🇬' },
	{ code: 'GR', name: 'Greece', flag: '🇬🇷' },
	{ code: 'HU', name: 'Hungary', flag: '🇭🇺' },
	{ code: 'RO', name: 'Romania', flag: '🇷🇴' },
].sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_MAP = new Map<string, Country>();
for (const c of COUNTRIES) {
	COUNTRY_MAP.set(c.code.toUpperCase(), c);
}

export function getCountryByCode(code?: string | null): Country | undefined {
	if (!code) return undefined;
	return COUNTRY_MAP.get(code.toUpperCase());
}

export function getCountryFlag(code?: string | null): string {
	if (!code) return '🌐';
	const found = getCountryByCode(code);
	if (found) return found.flag;
	// Convert arbitrary 2-letter ISO code to flag emoji
	if (code.length === 2) {
		const upper = code.toUpperCase();
		const offset = 127397;
		return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
	}
	return '🌐';
}

export function formatCountryName(code?: string | null): string {
	if (!code) return 'Global';
	const found = getCountryByCode(code);
	return found ? found.name : code.toUpperCase();
}
