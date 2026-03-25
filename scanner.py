import socket

def scan_ports(host, start_port, end_port):
    open_ports = []

    for port in range(start_port, end_port + 1):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)

        result = s.connect_ex((host, port))
        if result == 0:
            open_ports.append(port)

        s.close()

    return open_ports