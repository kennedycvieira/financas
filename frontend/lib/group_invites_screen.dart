import 'package:flutter/material.dart';
//import 'package:http/http.dart' as http;
//import 'dart:convert';
import 'auth_provider.dart';
import 'api_service.dart';

class GroupInvitesScreen extends StatefulWidget {
  const GroupInvitesScreen({super.key});

  @override
  _GroupInvitesScreenState createState() => _GroupInvitesScreenState();
}

class _GroupInvitesScreenState extends State<GroupInvitesScreen> {
  List<dynamic> _invites = [];
  bool _isLoading = true;
  String? _token;
  int? _userId;

  @override
  void initState() {
    super.initState();
    _loadInvites();
  }

  Future<void> _loadInvites() async {
    setState(() => _isLoading = true);
    try {
      _token = await AuthProvider.getToken();
      final user = await AuthProvider.getUser();
      _userId = user?['id'];
      if (_token != null && _userId != null) {
        final invites = await ApiService.getReceivedInvites(_token!, _userId!);
        //print(invites);
        setState(() => _invites = invites);
      }
    } catch (e) {
      // Handle error
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _acceptInvite(int inviteId) async {
    try {
      await ApiService.acceptInvite(_token!, _userId!, inviteId);
      _loadInvites();
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _rejectInvite(int inviteId) async {
    try {
      await ApiService.rejectInvite(_token!, _userId!, inviteId);
      _loadInvites();
    } catch (e) {
      // Handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Group Invites'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _invites.isEmpty
          ? const Center(child: Text('No invites found'))
          : ListView.builder(
        itemCount: _invites.length,
        itemBuilder: (context, index) {
          final invite = _invites[index];
          return Card(
            margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
            child: ListTile(
              title: Text(invite['description'] ?? 'No description'),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Group: ${invite['group_name']}'),
                  Text('From: ${invite['sender_username']}'),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [
                      Text('Status : '),
                      Icon(invite['status'] =='accepted' ?
                      Icons.check :
                      invite['status'] == 'pending' ? Icons.question_mark : Icons.close
                      )],
                  )
                ],
              ),
              trailing:Opacity(opacity :invite['status'] == 'pending'?1.0:0.0,child:Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.check, color: Colors.green),
                    onPressed: () => _acceptInvite(invite['id']),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.red),
                    onPressed: () => _rejectInvite(invite['id']),
                  ),
                ],
              ) ),
            ),
          );
        },
      ),
    );
  }
}