import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import {
	CircleUserRoundIcon,
	EllipsisVerticalIcon,
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
	SunIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function initials(value: string | undefined): string {
	if (!value) return "AD";
	const parts = value.split(/[@.\s]/).filter(Boolean);
	if (parts.length === 0) return value.slice(0, 2).toUpperCase();
	return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
}

export function NavUser() {
	const { isMobile } = useSidebar();
	const { signOut } = useAuthActions();
	const { isAuthenticated } = useConvexAuth();
	const { theme, toggleTheme } = useTheme();

	const email = isAuthenticated ? "Admin" : "—";
	const name = "Admin";
	const avatarFallback = initials(email);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
						}
					>
						<Avatar className="size-8 rounded-lg">
							<AvatarFallback className="rounded-lg">
								{avatarFallback}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">{name}</span>
							<span className="truncate text-xs text-foreground/70">
								{email}
							</span>
						</div>
						<EllipsisVerticalIcon className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="min-w-56"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="size-8">
										<AvatarFallback className="rounded-lg">
											{avatarFallback}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{name}</span>
										<span className="truncate text-xs text-muted-foreground">
											{email}
										</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem
								render={
									<Link to="/backup/$" params={{ _splat: "settings/account" }} />
								}
							>
								<CircleUserRoundIcon />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem render={<Link to="/settings" />}>
								<SettingsIcon />
								Settings
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								toggleTheme();
							}}
						>
							{theme === "light" ? <MoonIcon /> : <SunIcon />}
							{theme === "light" ? "Dark mode" : "Light mode"}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => void signOut()}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
