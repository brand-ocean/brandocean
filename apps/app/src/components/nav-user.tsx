import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import {
	CircleUserRoundIcon,
	LogOutIcon,
	MonitorIcon,
	MoonIcon,
	MoreHorizontalIcon,
	PaletteIcon,
	SettingsIcon,
	SunIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

function initials(value: string | undefined): string {
	if (!value) return "AD";
	const parts = value.split(/[@.\s]/).filter(Boolean);
	if (parts.length === 0) return value.slice(0, 2).toUpperCase();
	return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
}

const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: MonitorIcon },
] as const;

/** Light / dark / system as three round buttons in a pill, as in FORZ. */
function MenuThemeSwitch() {
	const { preference, setTheme } = useTheme();
	return (
		<div
			role="radiogroup"
			aria-label="Appearance"
			className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5"
		>
			{THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
				const isActive = preference === value;
				return (
					<Button
						key={value}
						type="button"
						role="radio"
						aria-checked={isActive}
						aria-label={label}
						variant="ghost"
						size="icon-xs"
						onClick={() => setTheme(value)}
						className={cn(
							"rounded-full",
							isActive
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="size-3.5" aria-hidden="true" />
					</Button>
				);
			})}
		</div>
	);
}

export function NavUser() {
	const { isMobile } = useSidebar();
	const { signOut } = useAuthActions();
	const { isAuthenticated } = useConvexAuth();

	const email = isAuthenticated ? "Admin" : "—";
	const name = "Admin";
	const avatarFallback = initials(email);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						className="h-auto shrink-0 border border-border bg-background p-1.5 text-sm shadow-sm shadow-black/5 group-data-[collapsible=icon]:justify-center"
						render={<SidebarMenuButton size="lg" aria-label="My profile" />}
					>
						<Avatar className="size-6 transition-all duration-300 ease-in-out in-data-[state=collapsed]:size-7!">
							<AvatarFallback className="rounded-md! bg-muted text-xs font-medium text-foreground">
								{avatarFallback}
							</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-semibold">{name}</span>
						</div>
						<MoreHorizontalIcon
							aria-hidden="true"
							className="mr-1 ml-auto size-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden"
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-60"
						side={isMobile ? "top" : "right"}
						align="end"
						sideOffset={8}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="flex items-center gap-2.5 py-2">
								<Avatar size="sm" className="size-8 rounded-md">
									<AvatarFallback className="rounded-md! bg-muted text-xs font-medium text-foreground">
										{avatarFallback}
									</AvatarFallback>
								</Avatar>
								<div className="flex min-w-0 flex-col">
									<span className="truncate text-sm font-semibold text-foreground">
										{name}
									</span>
									<span className="truncate text-xs font-normal text-muted-foreground">
										{email}
									</span>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem render={<Link to="/settings" />}>
								<CircleUserRoundIcon />
								Workspace details
							</DropdownMenuItem>
							<DropdownMenuItem render={<Link to="/billing" />}>
								<SettingsIcon />
								Usage billing
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem
								className="cursor-default focus:bg-transparent!"
								closeOnClick={false}
							>
								<PaletteIcon />
								Appearance
								<div className="ml-auto">
									<MenuThemeSwitch />
								</div>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => void signOut()}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
