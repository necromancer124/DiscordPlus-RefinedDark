// Discord+ installer helper: read/write .lnk shortcuts including their AppUserModelID.
// The taskbar groups a running window with a pinned shortcut by this ID, so a Discord+ pin must carry
// Discord's own ID (e.g. "com.squirrel.Discord.Discord") to merge with the Discord window.
// Loaded by install.ps1 / uninstall.ps1 with Add-Type.
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

namespace DiscordPlus
{
    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, uint fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
        void Resolve(IntPtr hwnd, uint fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PropertyKey pkey);
        void GetValue(ref PropertyKey key, out PropVariant pv);
        void SetValue(ref PropertyKey key, ref PropVariant pv);
        void Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;
        public PropertyKey(Guid f, uint p) { fmtid = f; pid = p; }
    }

    [StructLayout(LayoutKind.Explicit)]
    struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointer;
    }

    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    class CShellLink { }

    public static class Shortcut
    {
        // PKEY_AppUserModel_ID
        static PropertyKey AppIdKey = new PropertyKey(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);
        const ushort VT_LPWSTR = 31;

        [DllImport("ole32.dll")]
        static extern int PropVariantClear(ref PropVariant pvar);

        /// <summary>The shortcut's AppUserModelID, or "" if it has none.</summary>
        public static string GetAppId(string lnkPath)
        {
            var link = (IShellLinkW)new CShellLink();
            ((IPersistFile)link).Load(lnkPath, 0);
            var store = (IPropertyStore)link;
            PropVariant pv;
            store.GetValue(ref AppIdKey, out pv);
            string id = pv.vt == VT_LPWSTR ? Marshal.PtrToStringUni(pv.pointer) : "";
            PropVariantClear(ref pv);
            return id ?? "";
        }

        /// <summary>Create or overwrite a shortcut. appId may be null/"" for none.</summary>
        public static void Write(string lnkPath, string target, string arguments, string workingDir,
                                 string iconPath, string description, string appId)
        {
            var link = (IShellLinkW)new CShellLink();
            link.SetPath(target);
            link.SetArguments(arguments ?? "");
            if (!string.IsNullOrEmpty(workingDir)) link.SetWorkingDirectory(workingDir);
            if (!string.IsNullOrEmpty(iconPath)) link.SetIconLocation(iconPath, 0);
            if (!string.IsNullOrEmpty(description)) link.SetDescription(description);
            if (!string.IsNullOrEmpty(appId))
            {
                var store = (IPropertyStore)link;
                var pv = new PropVariant { vt = VT_LPWSTR, pointer = Marshal.StringToCoTaskMemUni(appId) };
                store.SetValue(ref AppIdKey, ref pv);
                store.Commit();
                PropVariantClear(ref pv);
            }
            ((IPersistFile)link).Save(lnkPath, true);
        }
    }
}
