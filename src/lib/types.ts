export interface LinkedItem {
	name: string;
	url?: string;
}

export interface Supergroup {
	name: string;
	url?: string;
	org: string;
	orgUrl?: string;
	mission: string;
	goals: string;
	vision: string;
	aboutUrl?: string;
	groups: LinkedItem[];
	subgroups: LinkedItem[];
	teams: LinkedItem[];
}
