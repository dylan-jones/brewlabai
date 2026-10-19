"use client";

import styled, { keyframes } from "styled-components";

export const Width = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 32px;
  @media (max-width: 640px) {
    padding: 0 16px;
  }
`;
export const Header = styled.header`
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
export const HeaderInner = styled(Width)`
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 32px;
  justify-content: space-between;
  flex-wrap: wrap;
  @media (max-width: 1050px) {
    gap: 12px;
    padding-top: 12px;
    padding-bottom: 12px;
  }
`;
export const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  flex-shrink: 0;
  strong {
    font-size: 15px;
    font-weight: 800;
  }
  small {
    display: block;
    color: ${({ theme }) => theme.colors.muted};
    font: 9px ${({ theme }) => theme.fonts.mono};
    margin-top: -1px;
  }
`;
export const Mark = styled.div`
  width: 35px;
  height: 38px;
  display: grid;
  place-items: center;
  color: white;
  background: ${({ theme }) => theme.colors.accent};
  border-radius: 5px;
`;
export const Nav = styled.nav`
  display: flex;
  align-items: stretch;
  gap: 23px;
  align-self: stretch;
  @media (max-width: 1050px) {
    order: 3;
    width: 100%;
    overflow-x: auto;
    gap: 24px;
    min-height: 36px;
  }
`;
export const NavButton = styled.button<{ $active?: boolean }>`
  position: relative;
  display: flex;
  gap: 7px;
  align-items: center;
  border: 0;
  border-bottom: 2px solid
    ${({ $active, theme }) => ($active ? theme.colors.accent : "transparent")};
  background: none;
  padding: 0;
  color: ${({ $active, theme }) => ($active ? theme.colors.ink : theme.colors.muted)};
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  white-space: nowrap;
  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;
export const Row = styled.div<{
  $gap?: number;
  $between?: boolean;
  $wrap?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ $gap }) => $gap ?? 8}px;
  ${({ $between }) => $between && "justify-content: space-between;"} ${({ $wrap }) => $wrap && "flex-wrap: wrap;"} min-width: 0;
`;
export const Muted = styled.span`
  color: ${({ theme }) => theme.colors.muted};
`;
export const Mono = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
`;
export const Eyebrow = styled.div`
  font: 10px ${({ theme }) => theme.fonts.mono};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.muted};
`;
export const Badge = styled.span<{ $tone?: "green" | "accent" | "blue" }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 3px;
  font: 10px ${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  background: ${({ theme, $tone }) => ($tone === "green" ? theme.colors.greenSoft : $tone === "accent" ? theme.colors.accentSoft : theme.colors.elevated)};
  color: ${({ theme, $tone }) => ($tone === "green" ? theme.colors.green : $tone === "accent" ? theme.colors.accent : theme.colors.muted)};
`;
export const Dot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
  flex-shrink: 0;
`;
export const Button = styled.button<{ $primary?: boolean; $small?: boolean }>`
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? theme.colors.accent : theme.colors.border)};
  background: ${({ theme, $primary }) => ($primary ? theme.colors.accent : theme.colors.surface)};
  color: ${({ $primary, theme }) => ($primary ? (theme.mode === "dark" ? "#24201e" : "#ffffff") : theme.colors.ink)};
  border-radius: 4px;
  padding: ${({ $small }) => ($small ? "6px 10px" : "9px 14px")};
  font-size: ${({ $small }) => ($small ? "11px" : "12px")};
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: ${({ $small }) => ($small ? "32px" : "38px")};
  white-space: nowrap;
  transition:
    filter 0.15s,
    border-color 0.15s;
  &:hover:not(:disabled) {
    filter: brightness(0.96);
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;
export const IconButton = styled.button`
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.colors.muted};
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.accentSoft};
  }
`;
export const Avatar = styled.div`
  width: 31px;
  height: 31px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.colors.elevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 10px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.accent};
`;
export const Identity = styled(Width)`
  padding-top: 27px;
  padding-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  h1 {
    font-size: 25px;
    line-height: 1.4;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
`;
export const Subtitle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 7px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
`;
export const MetricBand = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
export const Metrics = styled(Width)`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding-top: 19px;
  padding-bottom: 18px;
  gap: 24px;
  @media (max-width: 1150px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
  }
  @media (max-width: 600px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 19px;
  }
`;
export const Metric = styled.div`
  min-width: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  padding-right: 20px;
  &:last-child {
    border: 0;
    padding-right: 0;
  }
  h3 {
    font: 9px ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.muted};
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  strong {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 27px;
    line-height: 1.3;
    font-weight: 500;
  }
  small {
    font-size: 10px;
    color: ${({ theme }) => theme.colors.muted};
  }
  @media (max-width: 600px) {
    padding-right: 10px;
  }
`;
export const Track = styled.div<{ $percent: number; $color?: string }>`
  height: 3px;
  background: ${({ theme }) => theme.colors.elevated};
  margin: 10px 0 5px;
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${({ $percent }) => Math.min(100, Math.max(0, $percent))}%;
    background: ${({ theme, $color }) => $color ?? theme.colors.green};
  }
`;
export const ColorSwatch = styled.span<{ $color: string }>`
  display: inline-block;
  width: 20px;
  height: 24px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
  border: 1px solid #00000010;
  margin-right: 7px;
  vertical-align: text-bottom;
`;
export const WorkspaceHead = styled(Row)`
  justify-content: space-between;
  padding: 24px 0 19px;
  flex-wrap: wrap;
  gap: 12px;
`;
export const Segment = styled.div`
  display: flex;
  padding: 3px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 5px;
  gap: 3px;
`;
export const SegmentButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 6px 12px;
  min-height: 30px;
  border: 0;
  border-radius: 3px;
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.ink : theme.colors.muted)};
  font-size: 11px;
  font-weight: 600;
`;
export const Workspace = styled.div<{ $manual: boolean }>`
  display: grid;
  grid-template-columns: ${({ $manual }) => ($manual ? "minmax(0, 1fr)" : "minmax(300px, .78fr) minmax(0, 1.5fr)")};
  gap: 24px;
  align-items: start;
  padding-bottom: 32px;
  @media (max-width: 1050px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const Assistant = styled.aside`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  min-width: 0;
  overflow: hidden;
  position: sticky;
  top: 20px;
  @media (max-width: 1050px) {
    position: static;
    order: 2;
  }
`;
export const AssistantHead = styled.div`
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  h2 {
    font-size: 13px;
    font-weight: 700;
  }
  small {
    color: ${({ theme }) => theme.colors.muted};
    font-size: 10px;
  }
`;
export const AssistantBody = styled.div`
  padding: 20px;
  max-height: 600px;
  overflow-y: auto;
  scroll-behavior: smooth;
`;
export const AssistantIntro = styled.div`
  padding: 1px 0 20px;
  h3 {
    font-size: 20px;
    line-height: 1.6;
    font-weight: 600;
    margin: 13px 0 9px;
  }
  p {
    color: ${({ theme }) => theme.colors.muted};
    line-height: 1.85;
    font-size: 12px;
  }
`;
export const Insight = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 17px 0;
  font-size: 12px;
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 9px;
  }
  p {
    font-size: 11px;
    line-height: 1.9;
    color: ${({ theme }) => theme.colors.muted};
  }
  strong {
    color: ${({ theme }) => theme.colors.ink};
    font-weight: 600;
  }
`;
export const MatchLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 7px 0;
  font-size: 11px;
  > span:last-child {
    color: ${({ theme }) => theme.colors.green};
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;
export const Message = styled.div<{ $user?: boolean }>`
  padding: 15px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${({ theme, $user }) => ($user ? theme.colors.blue : theme.colors.accent)};
    font: 10px ${({ theme }) => theme.fonts.mono};
    margin: 0 0 7px;
  }
  p {
    font-size: 12px;
    white-space: pre-wrap;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
`;
export const ReplyBody = styled.div`
  min-width: 0;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  > :first-child { margin-top: 0; }
  > :last-child { margin-bottom: 0; }
  p { margin: 0 0 10px; white-space: normal; }
  h3, h4, h5, h6 {
    display: block;
    font: 700 12px ${({ theme }) => theme.fonts.sans};
    color: ${({ theme }) => theme.colors.ink};
    margin: 16px 0 6px;
    line-height: 1.5;
  }
  strong { font-weight: 700; color: ${({ theme }) => theme.colors.ink}; }
  ul, ol { padding-left: 20px; margin: 8px 0 12px; }
  li { padding-left: 2px; margin: 4px 0; }
  li > p { margin-bottom: 4px; }
  ul ul, ol ol, ul ol, ol ul { margin: 4px 0; }
  a { color: ${({ theme }) => theme.colors.accent}; text-decoration: underline; text-underline-offset: 3px; }
  blockquote {
    margin: 12px 0;
    padding: 2px 0 2px 12px;
    border-left: 2px solid ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.muted};
  }
  blockquote p:last-child { margin-bottom: 0; }
  code { font: 11px ${({ theme }) => theme.fonts.mono}; background: ${({ theme }) => theme.colors.elevated}; padding: 2px 4px; border-radius: 3px; }
  pre { max-width: 100%; overflow-x: auto; margin: 12px 0; padding: 12px; background: ${({ theme }) => theme.colors.elevated}; border-radius: 4px; }
  pre code { padding: 0; white-space: pre; overflow-wrap: normal; }
  .reply-table { max-width: 100%; overflow-x: auto; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 7px 9px; text-align: left; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; vertical-align: top; }
  th { font-weight: 700; background: ${({ theme }) => theme.colors.elevated}; }
  hr { border: 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; margin: 14px 0; }
  input[type="checkbox"] { width: 12px; height: 12px; margin-right: 5px; vertical-align: middle; }
`;
export const Composer = styled.form`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.elevated};
  textarea {
    width: 100%;
    resize: vertical;
    min-height: 74px;
    max-height: 200px;
    font-size: 12px;
    line-height: 1.7;
    border: 0;
    padding: 0;
    background: transparent;
    outline: none;
  }
`;
export const Canvas = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
`;
export const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  overflow-x: auto;
  gap: 24px;
  min-height: 38px;
  flex-shrink: 0;
`;
export const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.accent : "transparent")};
  padding: 0 1px 12px;
  background: none;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.muted)};
  white-space: nowrap;
`;
export const Section = styled.section`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 5px;
  min-width: 0;
  scroll-margin-top: 20px;
`;
export const SectionHead = styled.div`
  padding: 17px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  h2 {
    font-size: 12px;
    font-weight: 700;
  }
  p {
    font: 9px ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.muted};
    margin-top: 2px;
  }
`;
export const SectionNumber = styled.span`
  font: 11px ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.accent};
  align-self: flex-start;
  padding-top: 1px;
  margin-right: 4px;
`;
export const TableScroll = styled.div`
  overflow-x: auto;
  width: 100%;
`;
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  white-space: nowrap;
  font-size: 11px;
  th {
    font: 9px ${({ theme }) => theme.fonts.mono};
    text-transform: uppercase;
    font-weight: 400;
    color: ${({ theme }) => theme.colors.muted};
    background: ${({ theme }) => theme.colors.elevated};
    padding: 10px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
  td {
    padding: 13px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  td:first-child,
  th:first-child {
    padding-left: 18px;
  }
  td:last-child {
    padding-right: 12px;
  }
  td strong {
    font-size: 11px;
    font-weight: 600;
  }
  td small {
    display: block;
    font-size: 9px;
    color: ${({ theme }) => theme.colors.muted};
    margin-top: 2px;
  }
  input {
    width: 66px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    padding: 5px 6px;
    background: ${({ theme }) => theme.colors.elevated};
  }
  select {
    padding: 5px 6px;
    font-size: 10px;
    max-width: 108px;
  }
`;
export const SectionFoot = styled.div`
  padding: 10px 18px;
  background: ${({ theme }) => theme.colors.elevated};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font: 9px ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.muted};
  border-radius: 0 0 5px 5px;
`;
export const Pair = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
  padding: 18px;
  @media (max-width: 400px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted};
  input,
  select {
    width: 100%;
    color: ${({ theme }) => theme.colors.ink};
    font-size: 12px;
  }
`;
export const RecipeSettings = styled.section`
  padding: 20px 0;
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;
export const SettingsFields = styled(Fields)`
  padding: 0;
  margin-top: 18px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  @media (max-width: 1000px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 440px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const WaterStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px 18px;
  text-align: center;
  strong {
    font: 16px ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.blue};
    display: block;
  }
  small {
    color: ${({ theme }) => theme.colors.muted};
    font-size: 9px;
  }
`;
export const Sourcing = styled.section`
  border-left: 3px solid ${({ theme }) => theme.colors.green};
  background: ${({ theme }) => theme.colors.greenSoft};
  padding: 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  h3 {
    font-size: 12px;
    margin-bottom: 5px;
  }
  p {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.green};
  }
`;
export const Footer = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 16px 0;
  font: 9px ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.muted};
`;
export const ViewTitle = styled.div`
  padding: 32px 0 24px;
  h1 {
    font-size: 24px;
  }
  p {
    color: ${({ theme }) => theme.colors.muted};
    margin-top: 5px;
    font-size: 12px;
  }
`;
export const Empty = styled.div`
  padding: 50px 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  h3 {
    color: ${({ theme }) => theme.colors.ink};
    margin: 12px 0 8px;
    font-size: 15px;
  }
  p {
    font-size: 12px;
    margin-bottom: 20px;
  }
`;
export const Dialog = styled.dialog`
  width: min(580px, calc(100vw - 32px));
  max-height: 85dvh;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 7px;
  padding: 0;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  box-shadow: 0 20px 80px #0002;
  &::backdrop {
    background: #151a2070;
    backdrop-filter: blur(3px);
  }
`;
export const DialogBody = styled.div`
  padding: 24px;
  form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  textarea {
    width: 100%;
    min-height: 130px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
  }
  p {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.muted};
    line-height: 1.8;
  }
`;
export const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.danger} !important;
  font-size: 12px;
  padding: 10px 0;
`;
const reveal = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); }`;
export const Toast = styled.div`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
  width: max-content;
  background: ${({ theme }) => theme.colors.ink};
  color: ${({ theme }) => theme.colors.surface};
  padding: 12px 18px;
  border-radius: 5px;
  box-shadow: 0 5px 30px #0002;
  font-size: 12px;
  z-index: 100;
`;
export const Fade = styled.div`
  animation: ${reveal} 0.35s ease both;
`;
export const SupplierList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0;
  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
export const SupplierItem = styled.article`
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 24px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 5px;
  h3 {
    font-size: 15px;
    margin: 12px 0 5px;
  }
  p {
    color: ${({ theme }) => theme.colors.muted};
    font-size: 11px;
    margin-bottom: 15px;
  }
`;
