import { Link } from "@tanstack/react-router";
import {
	FileTextIcon,
	ImageIcon,
	LayoutDashboardIcon,
	ListChecksIcon,
	MessageSquareIcon,
	ReceiptIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import type * as React from "react";
import { Brandmark, Logotype } from "@/components/brand";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

// Wired or actively-being-wired routes. If a phase has not landed yet the
// link points at the matching `/backup/...` template so nothing 404s.
const primaryNav = [
	{
		title: "Dashboard",
		to: "/dashboard",
		icon: LayoutDashboardIcon,
		exact: false,
	},
	{ title: "Offertes", to: "/offertes", icon: FileTextIcon, exact: false },
	{ title: "Clients", to: "/clients", icon: UsersIcon, exact: false },
	{ title: "Invoices", to: "/invoices", icon: ReceiptIcon, exact: false },
	{ title: "Tasks", to: "/tasks", icon: ListChecksIcon, exact: false },
	{
		title: "Feedback",
		to: "/feedback",
		icon: MessageSquareIcon,
		exact: false,
	},
	{ title: "Portfolio", to: "/portfolio", icon: ImageIcon, exact: false },
	{ title: "Settings", to: "/settings", icon: SettingsIcon, exact: false },
] as const;

// Everything still living under /backup/$splat. Visible but corralled.
const temporaryGroups = [
	{
		section: "Settings",
		icon: SettingsIcon,
		items: [{ title: "Account", path: "settings/account" }],
	},
] as const;

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="data-[slot=sidebar-menu-button]:p-1.5! gap-2 [&_svg]:size-auto"
							render={<Link to="/offertes" />}
						>
							<Brandmark size={32} className="shrink-0" />
							<Logotype height={22} className="shrink-0" />
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>App</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{primaryNav.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										tooltip={item.title}
										render={
											<Link
												to={item.to}
												activeOptions={{ exact: item.exact }}
												activeProps={{ "data-active": "true" }}
											/>
										}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{temporaryGroups.map((group) => (
					<SidebarGroup key={group.section}>
						<SidebarGroupLabel>Temporary · {group.section}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => {
									const Icon =
										"icon" in item && item.icon ? item.icon : group.icon;
									return (
										<SidebarMenuItem key={item.path}>
											<SidebarMenuButton
												tooltip={item.title}
												render={
													<Link to="/backup/$" params={{ _splat: item.path }} />
												}
											>
												<Icon />
												<span>{item.title}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
